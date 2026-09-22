"""Exercise the actual frozen EXE with a scrubbed environment, optionally compare Docker."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def get(url):
    with OPENER.open(url, timeout=60) as response:
        return response.read()


def post(url, payload):
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with OPENER.open(request, timeout=120) as response:
        return json.load(response)


def wait_ready(directory, process):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Packaged process exited with {process.returncode}; inspect {directory}")
        try:
            state = json.loads((directory / "instance.json").read_text())
            url = f"http://127.0.0.1:{state['port']}"
            if json.loads(get(url + "/api/health")) == {"status": "ok"}:
                return state, url
        except (OSError, ValueError):
            pass
        time.sleep(0.1)
    raise RuntimeError("Packaged health check timed out")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", type=Path, default=Path("dist/GERT-Studio-Windows/GERT Studio.exe"))
    parser.add_argument("--compare-url", help="Running Docker backend URL, e.g. http://127.0.0.1:8000")
    parser.add_argument("--gui", action="store_true", help="Also exercise the normal control window")
    args = parser.parse_args()
    exe = args.exe.resolve()
    fixture = json.loads(Path(__file__).with_name("verification-project.json").read_text())
    # Do not inherit developer runtimes, Python site packages, Node, Git, Docker, or proxies.
    env = {key: value for key, value in os.environ.items() if key.upper() in
           {"SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"}}
    env["PATH"] = str(Path(env["SYSTEMROOT"]) / "System32")
    report = {"environment": "Windows developer host; runtime paths scrubbed (not a clean VM)", "checks": []}
    with tempfile.TemporaryDirectory(prefix="GERT verification בדיקה ") as temp:
        directory = Path(temp)
        state_dir = directory / "state"
        flags = ["--no-browser", "--state-dir", str(state_dir)] + ([] if args.gui else ["--headless"])
        process = subprocess.Popen([str(exe), *flags], cwd=directory, env=env)
        try:
            state, url = wait_ready(state_dir, process)
            report["checks"].append("EXE starts from unrelated working directory with runtime paths scrubbed; health OK")
            html = get(url + "/").decode()
            assert "GERT Studio" in html
            assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html)
            assert assets and all(get(url + asset) for asset in assets)
            report["checks"].append("Production index, JavaScript and CSS load")
            # Simultaneous repeat clicks must all reuse this PID/port.
            duplicates = [subprocess.Popen([str(exe), *flags], cwd=directory, env=env) for _ in range(3)]
            assert all(child.wait(timeout=45) == 0 for child in duplicates)
            assert json.loads((state_dir / "instance.json").read_text()) == state
            report["checks"].append("Three concurrent repeat launches reuse the original instance")
            assert post(url + "/api/models/validate", fixture["model"])["valid"]
            result = post(url + "/api/simulate", fixture)
            assert result == post(url + "/api/simulate", fixture)
            assert result["summary"]["statuses"]["terminal"]["count"] > 0
            report["checks"].append("Parallel/rework project validates and repeats exactly with a fixed seed")
            report["result_sha256"] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
            if args.compare_url:
                other = post(args.compare_url.rstrip("/") + "/api/simulate", fixture)
                if result != other:
                    Path("dist/windows-result.json").write_text(json.dumps(result, indent=2))
                    Path("dist/docker-result.json").write_text(json.dumps(other, indent=2))
                    raise AssertionError("Cross-distribution results differ; engine changes require semantic review.")
                report["checks"].append("Full JSON result exactly matches Docker (all runs, counters, metadata and aggregates)")
            subprocess.run([str(exe), "--headless", "--stop", "--state-dir", str(state_dir)], check=True, env=env, cwd=directory, timeout=15)
            assert process.wait(timeout=30) == 0
            assert not (state_dir / "instance.json").exists()
            try:
                get(url + "/api/health")
            except OSError:
                pass
            else:
                raise AssertionError("Server still listening after exit")
            report["checks"].append("Graceful stop exits the process, removes stale state and closes the port")
            # Exercise stale state recovery after ungraceful termination.
            process = subprocess.Popen([str(exe), *flags], cwd=directory, env=env)
            wait_ready(state_dir, process)
            process.kill()
            process.wait(timeout=10)
            process = subprocess.Popen([str(exe), *flags], cwd=directory, env=env)
            wait_ready(state_dir, process)
            subprocess.run([str(exe), "--headless", "--stop", "--state-dir", str(state_dir)], check=True, env=env, cwd=directory, timeout=15)
            assert process.wait(timeout=30) == 0
            report["checks"].append("Restart recovers the OS lock and stale state after a forced process crash")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)
            if (state_dir / "launcher.log").exists():
                Path("dist/windows-verification.log").write_bytes((state_dir / "launcher.log").read_bytes())
    Path("dist/windows-verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
