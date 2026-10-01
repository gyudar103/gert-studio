import pytest
from starlette.testclient import TestClient

from launcher import make_app, request_instance


def test_packaging_routes_preserve_shared_api_and_serve_static_files(tmp_path):
    (tmp_path / "index.html").write_text("<h1>GERT Studio</h1>")
    (tmp_path / "asset.js").write_text("const bundled = true;")
    stopped = []
    client = TestClient(make_app(tmp_path, "private-token", lambda: stopped.append(True)))
    assert client.get("/").text == "<h1>GERT Studio</h1>"
    assert client.get("/asset.js").status_code == 200
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/missing").status_code == 404
    assert client.get("/openapi.json").json()["info"]["version"] == "0.1.0"
    assert client.post("/api/simulate", content="{").status_code == 422
    assert client.get("/_launcher/status").status_code == 403
    assert client.post("/_launcher/stop").status_code == 403
    assert not stopped
    assert client.get("/_launcher/status", headers={"X-GERT-Launcher": "private-token"}).json()["ready"]
    assert client.post("/_launcher/stop", headers={"X-GERT-Launcher": "private-token"}).json() == {"stopping": True}
    assert stopped == [True]


def test_missing_frontend_fails_before_startup(tmp_path):
    with pytest.raises(RuntimeError, match="Extract the entire ZIP"):
        make_app(tmp_path, "token", lambda: None)


@pytest.mark.parametrize("port", [0, -1, 65536, "https://example.com", True])
def test_state_file_cannot_redirect_outside_loopback(port):
    with pytest.raises(ValueError, match="Invalid local port"):
        request_instance({"port": port, "token": "test"})


@pytest.mark.skipif(__import__('sys').platform != 'win32', reason='Windows byte locking')
def test_lock_excludes_second_launcher_and_is_released(tmp_path):
    from launcher import InstanceLock
    first = InstanceLock(tmp_path)
    try:
        assert first.file
        second = InstanceLock(tmp_path)
        assert second.file is None
    finally:
        first.close()
    third = InstanceLock(tmp_path)
    assert third.file
    third.close()


def test_owned_cleanup_preserves_other_build_outputs(tmp_path, monkeypatch):
    import build
    monkeypatch.setattr(build, "ROOT", tmp_path)
    for name in ("frontend/dist/stale.js", "build/gert-studio/stale.pyc", "dist/GERT-Studio-Windows/stale.dll",
                 "dist/GERT-Studio-Windows.zip", "dist/GERT-Studio-Windows.zip.sha256", "build/tooling/keep.txt"):
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("test")
    build.clean_outputs()
    assert (tmp_path / "build/tooling/keep.txt").read_text() == "test"
    assert not (tmp_path / "dist/GERT-Studio-Windows").exists()
    assert not (tmp_path / "dist/GERT-Studio-Windows.zip").exists()
    assert not (tmp_path / "frontend/dist").exists()


def test_host_preserves_current_draft_contract(tmp_path):
    import json
    from pathlib import Path
    from app.main import app
    fixture = json.loads((Path(__file__).resolve().parents[3] / "backend/tests/fixtures/reproducibility-demo.json").read_text(encoding="utf-8-sig"))
    fixture["model"]["activities"][0]["duration"] = None
    fixture["model"]["nodes"][0]["documentation"] = {"comments": "Keep this note"}
    (tmp_path / "index.html").write_text("GERT")
    packaged = TestClient(make_app(tmp_path, "test", lambda: None))
    native = TestClient(app)
    for path, body in (("/api/models/validate", fixture["model"]), ("/api/simulate", fixture)):
        left, right = packaged.post(path, json=body), native.post(path, json=body)
        assert (left.status_code, left.json()) == (right.status_code, right.json())
    assert packaged.post("/api/simulate", json=fixture).status_code == 422
