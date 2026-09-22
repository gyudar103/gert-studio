"""Portable Windows host. The shared API and engine are imported unchanged."""
from __future__ import annotations

import argparse
import ctypes
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import secrets
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser


def data_directory() -> Path:
    return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "GERT Studio"


class InstanceLock:
    """An OS-owned byte lock; Windows releases it even after a crash."""
    def __init__(self, directory: Path):
        import msvcrt
        self.file = (directory / "instance.lock").open("a+b")
        self.file.seek(0, 2)
        if not self.file.tell():
            self.file.write(b"0")
            self.file.flush()
        self.file.seek(0)
        try:
            msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            self.file.close()
            self.file = None

    def close(self):
        if self.file:
            self.file.close()
            self.file = None


def request_instance(state: dict, action="status"):
    # Never trust a stale state file to redirect the launcher to a remote URL.
    port = state["port"]
    if type(port) is not int or not 1 <= port <= 65535:
        raise ValueError("Invalid local port")
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/_launcher/{action}",
        headers={"X-GERT-Launcher": state["token"]},
        method="POST" if action == "stop" else "GET")
    # Local traffic must not go through a system HTTP proxy.
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=2) as response:
        return json.load(response)


def existing_instance(path: Path, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
            if request_instance(state) == {"application": "GERT Studio", "ready": True}:
                return state
        except (OSError, ValueError, KeyError):
            pass
        time.sleep(0.1)
    raise RuntimeError("Another GERT Studio instance is starting or is unresponsive. Try again shortly.")


def make_app(frontend: Path, token: str, stop):
    from app.main import app
    from starlette.responses import JSONResponse
    from starlette.routing import Mount, Route
    from starlette.staticfiles import StaticFiles
    from starlette.applications import Starlette

    if not (frontend / "index.html").is_file():
        raise RuntimeError("The frontend files are missing. Extract the entire ZIP before launching.")

    async def control(request):
        supplied = request.headers.get("X-GERT-Launcher", "")
        if not secrets.compare_digest(supplied, token):
            return JSONResponse({"error": "Forbidden"}, status_code=403)
        if request.url.path.endswith("/stop"):
            stop()
            return JSONResponse({"stopping": True})
        return JSONResponse({"application": "GERT Studio", "ready": True})

    # Route ASGI requests without stripping /api. The imported API is not mutated.
    # All other original API routes (/docs, /redoc, /openapi.json) remain available.
    return Starlette(routes=[
        Route("/_launcher/status", control, methods=["GET"]),
        Route("/_launcher/stop", control, methods=["POST"]),
        Route("/api/{path:path}", app, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]),
        Route("/docs", app), Route("/docs/oauth2-redirect", app),
        Route("/redoc", app), Route("/openapi.json", app),
        Mount("/", StaticFiles(directory=frontend, html=True)),
    ])


class LocalServer:
    def __init__(self, frontend: Path):
        import uvicorn
        self.token = secrets.token_urlsafe(32)
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        self.socket.bind(("127.0.0.1", 0))
        self.port = self.socket.getsockname()[1]
        self.url = f"http://127.0.0.1:{self.port}"
        self.error = None
        try:
            app = make_app(frontend, self.token, self.stop)
            self.server = uvicorn.Server(uvicorn.Config(
                app, host="127.0.0.1", port=self.port, loop="asyncio", http="h11",
                ws="none", lifespan="off", log_config=None, access_log=False))
        except BaseException:
            self.socket.close()
            raise
        self.thread = threading.Thread(target=self.run, name="GERT local server")

    def run(self):
        try:
            self.server.run(sockets=[self.socket])
        except BaseException as exc:
            self.error = exc
            logging.exception("Local server failed")
        finally:
            self.socket.close()

    def start(self):
        self.thread.start()
        deadline = time.monotonic() + 30
        while not self.server.started:
            if not self.thread.is_alive():
                raise RuntimeError("The local server could not start") from self.error
            if time.monotonic() >= deadline:
                self.stop()
                raise RuntimeError("The local server did not become ready within 30 seconds")
            time.sleep(0.05)

    def stop(self):
        self.server.should_exit = True


def show_window(server: LocalServer, open_browser):
    import tkinter as tk
    from tkinter import ttk, messagebox
    root = tk.Tk()
    root.title("GERT Studio")
    root.resizable(False, False)
    frame = ttk.Frame(root, padding=24)
    frame.pack()
    ttk.Label(frame, text="GERT Studio is running", font=("Segoe UI", 14)).pack(pady=(0, 12))
    ttk.Label(frame, text="Work in your browser. Keep this window open.\nExport your project before exiting.").pack()
    ttk.Label(frame, text=server.url).pack(pady=12)
    status = tk.StringVar(value="Closing a browser tab does not stop GERT Studio.")
    ttk.Label(frame, textvariable=status).pack(pady=8)

    def browse():
        try:
            if not webbrowser.open(server.url):
                messagebox.showinfo("GERT Studio", "Open this address in your browser:\n" + server.url)
        except Exception:
            logging.exception("Could not open browser")
            messagebox.showinfo("GERT Studio", "Open this address in your browser:\n" + server.url)

    def quit_app():
        if messagebox.askokcancel("Exit GERT Studio", "Export any work you want to keep before exiting.\nStop GERT Studio now?"):
            server.stop()

    ttk.Button(frame, text="Open GERT Studio", command=browse).pack(fill="x", pady=4)
    ttk.Button(frame, text="Exit GERT Studio", command=quit_app).pack(fill="x", pady=4)
    root.protocol("WM_DELETE_WINDOW", quit_app)

    def check():
        if not server.thread.is_alive():
            root.destroy()
            return
        if server.server.should_exit:
            status.set("Stopping — waiting for active requests to finish…")
        root.after(200, check)

    root.after(200, check)
    if open_browser:
        root.after(100, browse)
    root.mainloop()


def main(argv=None):
    parser = argparse.ArgumentParser(description="GERT Studio portable Windows launcher")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open a browser")
    parser.add_argument("--headless", action="store_true", help="Diagnostic mode without the control window")
    parser.add_argument("--stop", action="store_true", help="Gracefully stop this user's running instance")
    parser.add_argument("--state-dir", type=Path, default=data_directory(), help="Isolated diagnostics directory")
    args = parser.parse_args(argv)
    lock = None
    server = None
    state_path = args.state_dir / "instance.json"
    try:
        args.state_dir.mkdir(parents=True, exist_ok=True)
        if args.stop:
            request_instance(existing_instance(state_path, timeout=3), "stop")
            return 0
        lock = InstanceLock(args.state_dir)
        if not lock.file:
            state = existing_instance(state_path)
            if not args.no_browser:
                webbrowser.open(f"http://127.0.0.1:{state['port']}")
            return 0
        handler = RotatingFileHandler(args.state_dir / "launcher.log", maxBytes=2_000_000, backupCount=2, encoding="utf-8")
        logging.basicConfig(level=logging.INFO, handlers=[handler], format="%(asctime)s %(levelname)s %(message)s", force=True)
        logging.info("Starting GERT Studio with Python %s", sys.version)
        # Remove crash leftovers only after owning the OS lock.
        state_path.unlink(missing_ok=True)
        frontend = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2])) / "frontend" / "dist"
        server = LocalServer(frontend)
        server.start()
        state = {"port": server.port, "token": server.token, "pid": os.getpid()}
        temporary = state_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(state), encoding="utf-8")
        temporary.replace(state_path)
        request_instance(state)
        logging.info("Ready at %s", server.url)
        if args.headless:
            if not args.no_browser:
                webbrowser.open(server.url)
            server.thread.join()
        else:
            show_window(server, not args.no_browser)
        if server.error:
            raise RuntimeError("The local server stopped unexpectedly") from server.error
        return 0
    except Exception as exc:
        logging.exception("Launcher failure")
        if not args.headless:
            ctypes.windll.user32.MessageBoxW(None,
                f"GERT Studio could not start or stopped unexpectedly.\n\n{exc}\n\nLog: {args.state_dir / 'launcher.log'}",
                "GERT Studio", 0x10)
        return 1
    finally:
        if server:
            server.stop()
            if server.thread.ident:
                server.thread.join()
        if lock and lock.file:
            state_path.unlink(missing_ok=True)
            lock.close()
        logging.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
