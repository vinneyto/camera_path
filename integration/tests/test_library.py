import pytest

PLY = b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"
SOG = b"PK\x03\x04integration-fixture"


def upload(b, data=PLY, fmt="ply"):
    pending = b.request(
        "POST",
        "/api/v1/library/uploads",
        201,
        json={"name": "Fixture", "format": fmt, "size_bytes": len(data)},
    ).json()
    b.request("PUT", pending["upload_url"], 204, content=data)
    return b.request("POST", f"/api/v1/library/{pending['id']}/complete").json()


@pytest.mark.parametrize("fmt,data", [("ply", PLY), ("sog", SOG)])
def test_upload_download_defaults_instances_restart_and_delete(editor, fmt, data):
    b = editor
    pending = b.request(
        "POST",
        "/api/v1/library/uploads",
        201,
        json={"name": "Fixture", "format": fmt, "size_bytes": len(data)},
    ).json()
    assert pending["status"] == "pending"
    assert b.request("GET", "/api/v1/library", auth=False).json() == []
    base = f"/api/v1/library/{pending['id']}"
    b.request("GET", base, 404, auth=False)
    b.request("POST", base + "/complete", 422)
    b.request("PUT", pending["upload_url"], 401, content=data, auth=False)
    b.request("PUT", pending["upload_url"], 204, content=data)
    ready = b.request("POST", base + "/complete").json()
    assert ready["status"] == "ready" and ready["size_bytes"] == len(data)
    assert ready["format"] == fmt
    assert b.request("GET", ready["download_url"], auth=False).content == data
    b.request("PUT", pending["upload_url"], 409, content=data)
    defaults = {
        "default_rotation_deg": [15, -30, 90],
        "default_scale": 1.5,
        "default_offset": [0, -0.5, 0],
    }
    assert b.request("PATCH", base + "/defaults", json=defaults).json()["default_scale"] == 1.5
    p = b.project()
    first = p.mutate("POST", "/clouds", 201, json={"library_asset_id": ready["id"]}).json()
    second = p.mutate(
        "POST", "/clouds", 201, json={"library_asset_id": ready["id"], "translation": [2, 0.3, -4]}
    ).json()
    assert first["id"] != second["id"]
    assert first["scale"] == 1.5 and first["offset"] == defaults["default_offset"]
    assert second["translation"] == [2, 0.3, -4]
    updated = p.mutate(
        "PATCH", f"/clouds/{second['id']}", json={"visible": False, "position": 0}
    ).json()
    assert not updated["visible"]
    assert [x["id"] for x in p.get("/clouds").json()] == [second["id"], first["id"]]
    other = b.project("Other")
    other.mutate("POST", "/clouds", 201, json={"library_asset_id": ready["id"]})
    before = p.get("/clouds").json()
    b.stop()
    b.start()
    assert p.get("/clouds").json() == before
    assert b.request("GET", base, auth=False).json()["default_scale"] == 1.5
    assert b.request("GET", ready["download_url"], auth=False).content == data
    p.mutate("DELETE", f"/clouds/{second['id']}", 204)
    assert len(p.get("/clouds").json()) == 1
    assert len(other.get("/clouds").json()) == 1
    b.request("DELETE", base, 204)
    assert p.get("/clouds").json() == other.get("/clouds").json() == []
    b.request("GET", ready["download_url"], 404, auth=False)
    assert b.request("GET", "/api/v1/library", auth=False).json() == []


def test_bulk_delete_is_atomic_for_missing_ids(editor):
    b = editor
    a, second = upload(b), upload(b)
    p = b.project()
    p.mutate("POST", "/clouds", 201, json={"library_asset_id": a["id"]})
    before = p.get().headers["etag"]
    b.request("POST", "/api/v1/library/bulk-delete", 404, json={"asset_ids": [a["id"], "missing"]})
    assert len(b.request("GET", "/api/v1/library").json()) == 2
    assert len(p.get("/clouds").json()) == 1 and p.get().headers["etag"] == before
    b.request(
        "POST",
        "/api/v1/library/bulk-delete",
        204,
        json={"asset_ids": [a["id"], second["id"], a["id"]]},
    )
    assert b.request("GET", "/api/v1/library").json() == []
    assert p.get("/clouds").json() == []


def test_invalid_uploads_cannot_publish_or_change_other_assets(editor):
    b = editor
    good = upload(b)
    pending = b.request(
        "POST", "/api/v1/library/uploads", 201, json={"name": "Bad", "size_bytes": 4}
    ).json()
    b.request("PUT", pending["upload_url"], 413, content=b"12345")
    b.request("PUT", pending["upload_url"], 422, content=b"123")
    b.request("PUT", pending["upload_url"], 204, content=b"abcd")
    b.request("POST", f"/api/v1/library/{pending['id']}/complete", 422)
    assert [x["id"] for x in b.request("GET", "/api/v1/library").json()] == [good["id"]]
    assert b.request("GET", good["download_url"]).content == PLY
    b.request(
        "PATCH",
        f"/api/v1/library/{good['id']}/defaults",
        422,
        json={"default_rotation_deg": [0, 0, 0], "default_scale": 0},
    )
    p = b.project()
    p.mutate("POST", "/clouds", 404, json={"library_asset_id": pending["id"]})
    p.mutate(
        "POST", "/clouds", 422, json={"library_asset_id": good["id"], "translation": ["NaN", 0, 0]}
    )
    assert p.get("/clouds").json() == []
