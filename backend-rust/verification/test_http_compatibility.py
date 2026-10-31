from helpers import running


def test_historical_routes_keep_aggregate_bodies_and_statuses(tmp_path):
    with running(tmp_path) as b:
        b.login()
        created = b.request("POST", "/projects", 201, json={"name": "Legacy"}).json()
        assert created["anchors"] == {}
        path = f"/projects/{created['id']}"
        added = b.request(
            "POST", path + "/anchors", json={"label": "A", "surface_position": [1, 2, 3]}
        ).json()
        assert added["id"] == created["id"] and len(added["anchors"]) == 1
        anchor = next(iter(added["anchors"]))
        deleted = b.request("DELETE", path + f"/anchors/{anchor}").json()
        assert deleted["anchors"] == {}
        assert b.request("GET", "/projects").json() == [deleted]
        answer = b.request(
            "POST", path + "/chat/messages", json={"id": "legacy-chat", "message": "Answer"}
        ).json()
        assert "project" in answer and answer["project"]["id"] == created["id"]
        b.request("DELETE", path, 204)


def test_failed_streamed_reupload_keeps_bytes_and_range_reads_work(tmp_path):
    with running(tmp_path) as b:
        b.login()
        data = b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"
        pending = b.request(
            "POST", "/api/v1/library/uploads", 201, json={"name": "Stream", "size_bytes": len(data)}
        ).json()
        b.request("PUT", pending["upload_url"], 204, content=iter([data[:9], data[9:]]))
        b.request("PUT", pending["upload_url"], 422, content=iter([b"partial", b" data"]))
        assert not list((tmp_path / "library").glob("*.upload"))
        ready = b.request("POST", f"/api/v1/library/{pending['id']}/complete").json()
        url = ready["download_url"]
        assert b.request("GET", url, auth=False).content == data
        response = b.request("GET", url, 206, auth=False, headers={"Range": "bytes=2-8"})
        assert response.content == data[2:9]
        assert response.headers["content-range"] == f"bytes 2-8/{len(data)}"
        assert b.request("GET", url, 206, headers={"Range": "bytes=-5"}).content == data[-5:]
        response = b.request("HEAD", url, auth=False)
        assert response.content == b"" and int(response.headers["content-length"]) == len(data)
