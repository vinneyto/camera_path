"""Real HTTP + email login + queue worker, with test-owned model files only."""

import copy
import hashlib
import json
import time
from uuid import uuid4

PLY = b"ply\nformat ascii 1.0\nend_header\n"
SOG = b"PK\x03\x04fixture"


def descriptor(b):
    files = []
    for fmt, data, storage in [("sog", SOG, "library"), ("ply", PLY, "incoming")]:
        root = b.directory / storage
        root.mkdir(exist_ok=True)
        (root / f"tree.{fmt}").write_bytes(data)
        files.append(
            {
                "id": fmt,
                "format": fmt,
                "size_bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "source": {"storage": storage, "path": f"tree.{fmt}"},
            }
        )
    return {
        "schema_version": 1,
        "message_id": str(uuid4()),
        "item": {
            "client_id": str(uuid4()),
            "name": "Tree",
            "tags": [" Tree ", "tree"],
            "primary_file_id": "sog",
            "files": files,
        },
    }


def wait_result(b, message_id):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        response = b.request("GET", f"/api/v1/dev/library-imports/{message_id}").json()
        if response["status"] in {"succeeded", "failed"}:
            return response
        time.sleep(0.05)
    raise AssertionError("Import did not finish in the disposable local backend")


def enqueue(b, payload):
    # The dev API accepts the bytes of an actual JSON file, without a multipart wrapper.
    document = b.directory / "item.json"
    document.write_text(json.dumps(payload))
    response = b.request(
        "POST",
        "/api/v1/dev/library-imports",
        202,
        content=document.read_bytes(),
        headers={"Content-Type": "application/json"},
    )
    assert response.json() == {"message_id": payload["message_id"]}
    return wait_result(b, payload["message_id"])


def test_real_email_authenticated_import_multiple_files_and_restart(dev_backend):
    b = dev_backend
    data = descriptor(b)
    status = enqueue(b, data)
    assert status["status"] == "succeeded"
    asset = b.request("GET", f"/api/v1/library/{status['asset_id']}").json()
    assert asset["tags"] == ["Tree"]
    assert asset["primary_file_id"] == "sog" and asset["format"] == "sog"
    assert asset["size_bytes"] == len(SOG) and len(asset["files"]) == 2
    assert b.request("GET", asset["download_url"]).content == SOG
    for file in asset["files"]:
        assert b.request("GET", file["download_url"]).content == (
            SOG if file["id"] == "sog" else PLY
        )
    # Existing library source is kept, while the external source is copied to a new UUID key.
    assert (b.directory / "library/tree.sog").read_bytes() == SOG
    external_copies = list((b.directory / "library").glob("*.ply"))
    assert len(external_copies) == 1 and external_copies[0].name != "tree.ply"
    assert (b.directory / "incoming/tree.ply").read_bytes() == PLY
    assert (
        b.request("GET", f"/api/v1/library/by-client-id/{asset['client_id']}").json()["id"]
        == asset["id"]
    )
    b.stop()
    b.start()
    assert wait_result(b, data["message_id"])["asset_id"] == asset["id"]
    replay = copy.deepcopy(data)
    replay["message_id"] = str(uuid4())
    (b.directory / "incoming/tree.ply").unlink()
    assert enqueue(b, replay)["asset_id"] == asset["id"]
    assert len(b.request("GET", "/api/v1/library").json()) == 1
    b.request("DELETE", f"/api/v1/library/{asset['id']}", 204)
    assert not (b.directory / "library/tree.sog").exists() and not external_copies[0].exists()
    replay["message_id"] = str(uuid4())
    assert enqueue(b, replay)["error_code"] == "library_client_id_deleted"


def test_dev_import_rejects_unauthenticated_invalid_and_bad_files(dev_backend):
    b = dev_backend
    data = descriptor(b)
    b.request("POST", "/api/v1/dev/library-imports", 401, json=data, auth=False)
    b.request("GET", f"/api/v1/dev/library-imports/{data['message_id']}", 401, auth=False)
    b.request(
        "POST",
        "/api/v1/dev/library-imports",
        401,
        json=data,
        auth=False,
        headers={"Authorization": "Bearer invalid"},
    )
    b.request("GET", f"/api/v1/dev/library-imports/{uuid4()}", 404)
    invalid = copy.deepcopy(data)
    invalid["item"]["files"][0]["source"]["path"] = "../escape.sog"
    b.request("POST", "/api/v1/dev/library-imports", 422, json=invalid)
    b.request("POST", "/api/v1/dev/library-imports", 413, content=b" " * (256 * 1024 + 1))
    data["item"]["files"][1]["sha256"] = "0" * 64
    status = enqueue(b, data)
    assert status["status"] == "failed" and status["error_code"] == "library_import_invalid_file"
    assert b.request("GET", "/api/v1/library").json() == []
    assert (b.directory / "library/tree.sog").read_bytes() == SOG
    assert not list((b.directory / "library").glob("*.ply"))
    b.request("POST", "/api/v1/dev/library-imports", 202, json=data)
    assert wait_result(b, data["message_id"])["attempts"] == 1
    data["item"]["name"] = "Changed"
    assert (
        b.request("POST", "/api/v1/dev/library-imports", 409, json=data).json()["code"]
        == "queue_message_id_conflict"
    )


def test_disabled_dev_routes_are_absent(backend):
    backend.request("POST", "/api/v1/dev/library-imports", 404, json={})
    backend.request("GET", f"/api/v1/dev/library-imports/{uuid4()}", 404)
    assert (
        "/api/v1/dev/library-imports"
        not in backend.request("GET", "/api/v1/openapi.json").json()["paths"]
    )
