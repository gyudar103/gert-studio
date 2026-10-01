"""Run with a Windows x64 Python 3.12 installation; no Docker required."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def clean_outputs():
    # Only owned generated outputs; preserve downloaded tools and other workstreams.
    for relative in ("frontend/dist", "build/gert-studio", "dist/GERT-Studio-Windows",
                     "dist/GERT-Studio-Windows.zip", "dist/GERT-Studio-Windows.zip.sha256"):
        target = ROOT / relative
        if target.resolve() != ROOT.resolve() / relative:
            raise RuntimeError(f"Refusing cleanup through a redirected path: {target}")
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()


def run(command, **kwargs):
    print("Running:", " ".join(map(str, command)), flush=True)
    return subprocess.run(list(map(str, command)), check=True, **kwargs)


def licenses(destination):
    destination.mkdir()
    for source in (ROOT / "packaging/windows/licenses").glob("*.txt"):
        shutil.copy2(source, destination / source.name)
    # Retain licenses from build dependencies too; this intentionally over-includes.
    for distribution in importlib.metadata.distributions():
        name = distribution.metadata["Name"]
        for entry in distribution.files or []:
            if any(part.lower().startswith(("license", "copying", "notice")) for part in entry.parts):
                source = Path(distribution.locate_file(entry))
                if source.is_file():
                    target = destination / "python-packages" / name / str(entry).replace("../", "")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, target)
    base = Path(sys.base_prefix)
    for source in [base / "LICENSE.txt", base / "LICENSE", base / "tcl/tcl8.6/license.terms", base / "tcl/tk8.6/license.terms"]:
        if source.is_file():
            target = destination / ("Python-" + source.name if source.parent == base else source.parent.name + "-license.txt")
            shutil.copy2(source, target)
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text())
    for package, info in lock["packages"].items():
        if not package or info.get("dev"):
            continue
        source = ROOT / "frontend" / package
        for entry in source.iterdir():
            if entry.is_file() and entry.name.lower().startswith(("license", "copying", "notice")):
                target = destination / "frontend" / package / entry.name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(entry, target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--npm", default="npm.cmd", help="npm.cmd or npm-cli.js path")
    parser.add_argument("--inside-build-env", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    os.chdir(ROOT)
    if sys.platform != "win32" or sys.version_info[:2] != (3, 12) or platform.machine().lower() not in ("amd64", "x86_64"):
        raise SystemExit("Build on Windows x64 using Python 3.12 (required by the engine RNG contract).")
    if not args.inside_build_env:
        environment = ROOT / ".venv-windows"
        if not environment.exists():
            run([sys.executable, "-m", "venv", environment])
        python = environment / "Scripts/python.exe"
        run([python, "-m", "pip", "install", "-r", ROOT / "packaging/windows/requirements-build.txt"])
        run([python, __file__, "--inside-build-env", "--npm", args.npm])
        return
    import tkinter
    import PyInstaller
    tcl_version = tkinter.Tcl().eval("info patchlevel")
    assert tcl_version, "Tcl/Tk must be available to bundle the control window"
    npm_path = Path(args.npm)
    npm = ["node", str(npm_path.resolve())] if npm_path.suffix == ".js" else [shutil.which(args.npm) or args.npm]
    node_version = subprocess.check_output(["node", "--version"], text=True).strip()
    if int(node_version.lstrip("v").split(".")[0]) != 22:
        raise SystemExit("Use Node.js 22 for the release build.")
    clean_outputs()
    env = dict(os.environ, PYTHONPATH=os.pathsep.join([str(ROOT / "backend"), str(ROOT / "packaging/windows")]))
    run([sys.executable, "-m", "pytest", "backend/tests", "packaging/windows/tests", "-q", "-p", "no:cacheprovider"], env=env)
    for command in [["ci"], ["test"], ["run", "build"]]:
        run(npm + command, cwd=ROOT / "frontend")
    run([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "packaging/windows/gert-studio.spec"])
    artifact = ROOT / "dist/GERT-Studio-Windows"
    shutil.copy2(ROOT / "packaging/windows/README.txt", artifact / "README.txt")
    shutil.copy2(ROOT / "packaging/windows/THIRD_PARTY_NOTICES.txt", artifact / "THIRD_PARTY_NOTICES.txt")
    licenses(artifact / "LICENSES")
    try:
        revision = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], text=True).strip())
    except (OSError, subprocess.CalledProcessError):
        revision, dirty = "unknown", True
    manifest = {"source_commit": revision, "source_dirty": dirty,
                "python": sys.version, "platform": platform.platform(), "node": node_version,
                "pyinstaller": PyInstaller.__version__, "tcl": tcl_version,
                "installed_build_packages": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()},
                "files": {str(p.relative_to(artifact)).replace("\\", "/"): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in artifact.rglob("*") if p.is_file()}}
    sys.path.insert(0, str(ROOT / "backend"))
    from app.engine.randomness import ENGINE_VERSION, REPRODUCIBILITY_VERSION
    manifest.update(engine_version=ENGINE_VERSION, reproducibility_version=REPRODUCIBILITY_VERSION,
                    application_sources={str(p.relative_to(ROOT)).replace("\\", "/"): hashlib.sha256(p.read_bytes()).hexdigest()
                                         for p in (ROOT / "backend/app").rglob("*.py")})
    (artifact / "build-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    run([sys.executable, "packaging/windows/verify.py", "--exe", artifact / "GERT Studio.exe"])
    archive = shutil.make_archive(str(ROOT / "dist/GERT-Studio-Windows"), "zip", ROOT / "dist", artifact.name)
    digest = hashlib.sha256(Path(archive).read_bytes()).hexdigest()
    Path(archive + ".sha256").write_text(digest + "  " + Path(archive).name + "\n", encoding="ascii")
    print("Portable release:", archive, flush=True)


if __name__ == "__main__":
    main()
