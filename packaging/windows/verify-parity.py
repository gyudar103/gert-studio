"""Compare real packaged/native Windows HTTP responses, optionally with Docker."""
import argparse
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.error

from launcher import request_instance
from verify import get, post, wait_ready

ROOT = Path(__file__).resolve().parents[2]


def first_difference(left, right, path="$"):
    if type(left) is not type(right):
        return {"path": path, "left": left, "right": right}
    if isinstance(left, dict):
        if left.keys() != right.keys():
            return {"path": path, "left_keys": sorted(left), "right_keys": sorted(right)}
        for key in left:
            difference = first_difference(left[key], right[key], f"{path}.{key}")
            if difference:
                return difference
    elif isinstance(left, list):
        if len(left) != len(right):
            return {"path": path, "left_length": len(left), "right_length": len(right)}
        for index, (a, b) in enumerate(zip(left, right)):
            difference = first_difference(a, b, f"{path}[{index}]")
            if difference:
                return difference
    elif left != right:
        return {"path": path, "left": left, "right": right}
    return None


def scenarios(fixture):
    yield "parallel-rework", fixture
    documented = deepcopy(fixture)
    documented["model"]["nodes"][0]["documentation"] = {"comments": "Current main notes", "certainty": "Unverified"}
    documented["model"]["activities"][0]["duration_documentation"] = {"rationale": "Trial", "references": "Notebook"}
    documented["model"]["activities"][0]["outcomes"][0]["documentation"] = {"assumptions": "Documented"}
    yield "documented-parallel-rework", documented
    definitions = [
        {"type": "fixed", "value": "0.100000000000000000001"},
        {"type": "uniform", "min": "0.1", "max": "3.7"},
        {"type": "triangular", "min": "0.1", "mode": "1.2", "max": "3.7"},
        *[{"type": "beta-PERT", "min": "0.1", "mode": mode, "max": "3.7", "lambda": shape}
          for mode, shape in (("1.2", "4"), ("0.1", "4"), ("3.7", "4"),
                              ("1.9", "0.125"), ("1.9", "20"), ("1.2", "1e-30"))],
    ]
    for index, duration in enumerate(definitions):
        model = {"schema_version": "0.1", "project": {"id": "parity", "name": "Distribution parity"},
                 "item_types": [{"id": "token", "label": "Token"}],
                 "nodes": [{"id": "start", "label": "Start", "type": "start", "initial_inventory": {"token": "1"}},
                           *[{"id": n, "label": n, "type": "terminal", "outcome_code": n,
                              "outcome_label": n, "outcome_category": "success"} for n in ("a", "b")]],
                 "activities": [{"id": "probe", "label": "Probe", "source_node": "start", "requirements": {"token": "1"},
                                 "duration": duration, "outcomes": [
                                     {"id": n, "label": n, "target_node": n, "probability": p, "produced_items": {}}
                                     for n, p in (("a", "0.3"), ("b", "0.7"))]}]}
        yield f"distribution-{index}-{duration['type']}", {"model": model, "settings": {**fixture["settings"], "realizations": 128}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", type=Path, default=ROOT / "dist/GERT-Studio-Windows/GERT Studio.exe")
    parser.add_argument("--docker-url", help="For example http://127.0.0.1:8000")
    args = parser.parse_args()
    exe = args.exe.resolve()
    sys.path.insert(0, str(ROOT / "backend"))
    from app.engine.randomness import ENGINE_VERSION, REPRODUCIBILITY_VERSION
    fixture = json.loads((ROOT / "backend/tests/fixtures/reproducibility-demo.json").read_text(encoding="utf-8-sig"))
    manifest = json.loads((exe.parent / "build-manifest.json").read_text())
    assert manifest["engine_version"] == ENGINE_VERSION
    assert manifest["reproducibility_version"] == REPRODUCIBILITY_VERSION
    for name, expected in manifest["application_sources"].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, f"Stale source: {name}"
    isolated = {k: v for k, v in os.environ.items() if k.upper() in
                {"SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA"}}
    isolated["PATH"] = str(Path(isolated["SYSTEMROOT"]) / "System32")
    native_env = dict(isolated, PYTHONPATH=str(ROOT / "backend"))
    report = {"engine_version": ENGINE_VERSION, "reproducibility_version": REPRODUCIBILITY_VERSION,
              "source_commit": manifest["source_commit"], "cases": [], "passed": False}
    processes = []
    try:
        with tempfile.TemporaryDirectory(prefix="GERT parity ") as temp:
            for name, command, env in (
                ("packaged", [str(exe)], isolated),
                ("native", [sys.executable, str(ROOT / "packaging/windows/launcher.py")], native_env)):
                directory = Path(temp) / name
                process = subprocess.Popen([*command, "--headless", "--no-browser", "--state-dir", str(directory)],
                                           env=env, cwd=temp)
                processes.append((process, directory))
            try:
                endpoints = {name: wait_ready(directory, process)[1]
                             for name, (process, directory) in zip(("packaged", "native"), processes)}
                if args.docker_url:
                    endpoints["docker"] = args.docker_url.rstrip("/")
                for route in ("/api/health", "/openapi.json"):
                    values = {name: json.loads(get(url + route)) for name, url in endpoints.items()}
                    assert all(value == values["native"] for value in values.values()), route
                index = (ROOT / "frontend/dist/index.html").read_text(encoding="utf-8")
                marker = '<meta name="gert-panel-preferences" content="native-v1">'
                hosted_index = (index.replace("<head>", "<head>" + marker, 1)
                                if "<head>" in index else marker + index).encode("utf-8")
                assert get(endpoints["packaged"] + "/") == hosted_index
                assert get(endpoints["native"] + "/") == hosted_index
                for asset in (ROOT / "frontend/dist").rglob("*"):
                    if asset.is_file():
                        route = "/" + asset.relative_to(ROOT / "frontend/dist").as_posix()
                        expected = hosted_index if route == "/index.html" else asset.read_bytes()
                        assert get(endpoints["packaged"] + route) == expected
                        assert get(endpoints["native"] + route) == expected
                report["health_openapi_frontend_assets"] = "exact"
                for name, payload in scenarios(fixture):
                    results = {label: post(url + "/api/simulate", payload) for label, url in endpoints.items()}
                    for label, result in results.items():
                        difference = first_difference(results["native"], result)
                        if difference:
                            report["divergence"] = {"scenario": name, "native_vs": label, **difference}
                            raise AssertionError(json.dumps(report["divergence"]))
                        assert result["engine_version"] == ENGINE_VERSION
                        assert result["reproducibility_version"] == REPRODUCIBILITY_VERSION
                    report["cases"].append({"name": name, "realizations": payload["settings"]["realizations"],
                        "compared": list(endpoints), "sha256": hashlib.sha256(json.dumps(results["native"], sort_keys=True).encode()).hexdigest()})
                    print("Exact:", name, flush=True)
                # Current draft acceptance and missing-input errors must survive hosting unchanged.
                draft = deepcopy(fixture)
                draft["model"]["activities"][0]["duration"] = None
                draft["model"]["activities"][0]["outcomes"][0]["probability"] = None
                reports = [post(url + "/api/models/validate", draft["model"]) for url in endpoints.values()]
                assert all(value == reports[0] for value in reports)
                assert reports[0]["draft_valid"] and not reports[0]["simulation_ready"]
                errors = []
                for url in endpoints.values():
                    try:
                        post(url + "/api/simulate", draft)
                    except urllib.error.HTTPError as error:
                        assert error.code == 422
                        errors.append(json.load(error))
                    else:
                        raise AssertionError("Incomplete draft was simulated")
                assert all(value == errors[0] for value in errors)
                report["draft_validation_and_422"] = "exact"
                report["passed"] = True
            finally:
                for process, directory in processes:
                    if process.poll() is None:
                        try:
                            state = json.loads((directory / "instance.json").read_text())
                            request_instance(state, "stop")
                            process.wait(timeout=30)
                        except Exception:
                            process.kill()
                            process.wait(timeout=10)
                    if (directory / "launcher.log").exists():
                        (ROOT / "dist" / f"parity-{directory.name}.log").write_bytes((directory / "launcher.log").read_bytes())
    finally:
        (ROOT / "dist/windows-parity.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "cases"}, indent=2))


if __name__ == "__main__":
    main()
