import json
import socket
import sys
import urllib.request

import pytest
from starlette.testclient import TestClient

from launcher import LocalServer, make_app

LAYOUT = {"version": 1, "sidebar": 280, "properties": 420, "analysis": 300}
ENDPOINT = "/api/ui-preferences/panel-layout"


def test_portable_html_advertises_preference_bridge(tmp_path):
    from launcher import make_app
    from starlette.testclient import TestClient
    (tmp_path / "index.html").write_text("<html><head></head><body>GERT</body></html>")
    app = make_app(tmp_path, "test", lambda: None, preferences_path=tmp_path / "panel-layout.json", origin="http://testserver")
    client = TestClient(app)
    for path in ("/", "/index.html"):
        response = client.get(path)
        assert '<head><meta name="gert-panel-preferences" content="native-v1">' in response.text
        assert response.headers["cache-control"] == "no-store"
ORIGIN = "http://127.0.0.1:51234"


def client_for(tmp_path, origin=ORIGIN):
    (tmp_path / "index.html").write_text("GERT")
    return TestClient(make_app(tmp_path, "private-stop-token", lambda: None,
                              preferences_path=tmp_path / "panel-layout.json", origin=origin), base_url=origin)


def test_preferences_follow_state_directory_across_port_changes(tmp_path):
    client = client_for(tmp_path)
    assert client.get(ENDPOINT).json() == {"layout": None}
    saved = client.put(ENDPOINT, json=LAYOUT, headers={"Origin": ORIGIN})
    assert saved.status_code == 200 and saved.json() == {"layout": LAYOUT}
    assert saved.headers["cache-control"] == "no-store"
    assert json.loads((tmp_path / "panel-layout.json").read_text()) == LAYOUT
    assert not list(tmp_path.glob("panel-layout-*.tmp"))
    restarted = client_for(tmp_path, "http://127.0.0.1:51235")
    assert restarted.get(ENDPOINT).json() == {"layout": LAYOUT}
    assert restarted.post("/_launcher/stop").status_code == 403


@pytest.mark.parametrize("value", [{}, {**LAYOUT, "version": 2}, {**LAYOUT, "version": True},
    {**LAYOUT, "sidebar": "280"}, {**LAYOUT, "properties": -1}, {**LAYOUT, "analysis": True},
    {**LAYOUT, "analysis": 100001}, {**LAYOUT, "model": {}}, {**LAYOUT, "token": "anything"}])
def test_preferences_reject_non_numeric_unknown_and_obsolete_data(tmp_path, value):
    client = client_for(tmp_path)
    assert client.put(ENDPOINT, json=value, headers={"Origin": ORIGIN}).status_code == 422
    assert not (tmp_path / "panel-layout.json").exists()


def test_preferences_are_origin_checked_and_bounded(tmp_path):
    client = client_for(tmp_path)
    assert client.put(ENDPOINT, json=LAYOUT).status_code == 403
    for headers in ({"Origin": "https://attacker.example"},
                    {"Origin": ORIGIN, "Sec-Fetch-Site": "cross-site"},
                    {"Origin": ORIGIN, "Host": "attacker.example"}):
        assert client.put(ENDPOINT, json=LAYOUT, headers=headers).status_code == 403
        assert client.get(ENDPOINT, headers=headers).status_code == 403
    assert client.put(ENDPOINT, content="{}", headers={"Origin": ORIGIN, "Content-Type":"text/plain"}).status_code == 403
    assert client.put(ENDPOINT, content="x"*1025, headers={"Origin": ORIGIN, "Content-Type":"application/json"}).status_code == 413
    assert not (tmp_path / "panel-layout.json").exists()


@pytest.mark.parametrize("saved", ["{", '{"version":2}', '{"version":1,"sidebar":NaN,"properties":300,"analysis":250}', " "*1025])
def test_bad_saved_preferences_are_ignored(tmp_path, saved):
    client = client_for(tmp_path)
    (tmp_path / "panel-layout.json").write_text(saved)
    assert client.get(ENDPOINT).json() == {"layout": None}


@pytest.mark.skipif(sys.platform != "win32", reason="Windows loopback socket configuration")
def test_actual_windows_server_restart_on_new_port_restores_layout(tmp_path):
    (tmp_path / "index.html").write_text("GERT")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    first = LocalServer(tmp_path, tmp_path)
    first.start()
    try:
        request = urllib.request.Request(first.url + ENDPOINT, data=json.dumps(LAYOUT).encode(), method="PUT",
                                         headers={"Origin": first.url, "Content-Type": "application/json"})
        with opener.open(request, timeout=5) as response:
            assert json.load(response) == {"layout": LAYOUT}
    finally:
        first.stop()
        first.thread.join(timeout=10)
    assert not first.thread.is_alive()
    # Reserve the old port to prove restoration also works when it is unavailable.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as occupied:
        occupied.bind(("127.0.0.1", first.port))
        second = LocalServer(tmp_path, tmp_path)
        second.start()
        try:
            assert second.port != first.port
            with opener.open(second.url + ENDPOINT, timeout=5) as response:
                assert json.load(response) == {"layout": LAYOUT}
        finally:
            second.stop()
            second.thread.join(timeout=10)
        assert not second.thread.is_alive()
