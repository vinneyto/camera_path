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
        "schema_version": 2,
        "job_id": b.request("POST", "/api/v1/jobs", 201).json()["id"],
        "message_id": str(uuid4()),
        "assets": [
            {
                "name": "Tree",
                "tags": [" Tree ", "tree"],
                "primary_file_id": "sog",
                "files": files,
            }
        ],
    }


def wait_result(b, message_id):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        response = b.request("GET", f"/api/v1/dev/job-completions/{message_id}", auth=False).json()
        if response["status"] in {"succeeded", "failed"}:
            return response
        time.sleep(0.05)
    raise AssertionError("Import did not finish in the disposable local backend")


def enqueue(b, payload):
    # The dev API accepts the bytes of an actual JSON file, without a multipart wrapper.
    document = b.directory / "job-completion.json"
    document.write_text(json.dumps(payload))
    response = b.request(
        "POST",
        "/api/v1/dev/job-completions",
        202,
        content=document.read_bytes(),
        headers={"Content-Type": "application/json"},
        auth=False,
    )
    assert response.json() == {"message_id": payload["message_id"]}
    return wait_result(b, payload["message_id"])


def test_unauthenticated_job_completion_multiple_files_and_restart(dev_backend):
    b = dev_backend
    data = descriptor(b)
    status = enqueue(b, data)
    assert status["status"] == "succeeded"
    job = b.request("GET", f"/api/v1/jobs/{status['job_id']}", auth=False).json()
    assert job["completed_at"] is not None
    asset = job["assets"][0]
    assert asset["job_id"] == job["id"]
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
    b.stop()
    b.start()
    assert wait_result(b, data["message_id"])["job_id"] == job["id"]
    replay = copy.deepcopy(data)
    replay["message_id"] = str(uuid4())
    (b.directory / "incoming/tree.ply").unlink()
    assert enqueue(b, replay)["job_id"] == job["id"]
    assert b.request("GET", f"/api/v1/jobs/{job['id']}").json() == job
    assert len(b.request("GET", "/api/v1/library").json()) == 1
    b.request("DELETE", f"/api/v1/library/{asset['id']}", 204)
    assert not (b.directory / "library/tree.sog").exists() and not external_copies[0].exists()
    replay["message_id"] = str(uuid4())
    assert enqueue(b, replay)["status"] == "succeeded"
    deleted = b.request("GET", f"/api/v1/jobs/{job['id']}").json()
    assert deleted["completed_at"] == job["completed_at"] and deleted["assets"] == []


def test_dev_completion_validates_without_authentication(dev_backend):
    b = dev_backend
    data = descriptor(b)
    b.request("GET", f"/api/v1/dev/job-completions/{uuid4()}", 404, auth=False)
    invalid = copy.deepcopy(data)
    invalid["assets"][0]["files"][0]["source"]["path"] = "../escape.sog"
    b.request(
        "POST",
        "/api/v1/dev/job-completions",
        422,
        json=invalid,
        auth=False,
        headers={"Authorization": "Bearer invalid"},
    )
    b.request(
        "POST", "/api/v1/dev/job-completions", 413, content=b" " * (256 * 1024 + 1), auth=False
    )
    data["assets"][0]["files"][1]["sha256"] = "0" * 64
    status = enqueue(b, data)
    assert status["status"] == "failed" and status["error_code"] == "library_import_invalid_file"
    assert b.request("GET", "/api/v1/library").json() == []
    job = b.request("GET", f"/api/v1/jobs/{data['job_id']}").json()
    assert job["completed_at"] is None and job["assets"] == []
    assert (b.directory / "library/tree.sog").read_bytes() == SOG
    assert not list((b.directory / "library").glob("*.ply"))
    b.request(
        "POST",
        "/api/v1/dev/job-completions",
        202,
        json=data,
        auth=False,
        headers={"Authorization": "Bearer invalid"},
    )
    assert wait_result(b, data["message_id"])["attempts"] == 1
    data["assets"][0]["name"] = "Changed"
    assert (
        b.request("POST", "/api/v1/dev/job-completions", 409, json=data, auth=False).json()["code"]
        == "queue_message_id_conflict"
    )


def test_disabled_dev_routes_are_absent(backend):
    backend.request("POST", "/api/v1/dev/job-completions", 404, json={}, auth=False)
    backend.request("GET", f"/api/v1/dev/job-completions/{uuid4()}", 404, auth=False)
    assert (
        "/api/v1/dev/job-completions"
        not in backend.request("GET", "/api/v1/openapi.json").json()["paths"]
    )


def test_jobs_reservation_validation_and_unknown_completion(dev_backend):
    b = dev_backend
    b.request("POST", "/api/v1/jobs", 401, auth=False)
    reserved = b.request("POST", "/api/v1/jobs", 201).json()
    assert reserved == {"id": reserved["id"], "completed_at": None, "assets": []}
    assert b.request("GET", f"/api/v1/jobs/{reserved['id']}", auth=False).json() == reserved
    b.request("GET", "/api/v1/jobs/not-a-uuid", 422)
    b.request("GET", f"/api/v1/jobs/{uuid4()}", 404)
    payload = descriptor(b)
    payload["job_id"] = str(uuid4())
    # An unknown job fails before any source is read.
    (b.directory / "incoming/tree.ply").unlink()
    result = enqueue(b, payload)
    assert result["status"] == "failed" and result["error_code"] == "job_not_found"
    b.request("GET", f"/api/v1/jobs/{payload['job_id']}", 404)
    legacy = {"schema_version": 1, "message_id": str(uuid4()), "item": {}}
    b.request("POST", "/api/v1/dev/job-completions", 422, json=legacy, auth=False)


def test_documented_helper_submits_two_ply_files(dev_backend):
    import subprocess
    import sys
    from pathlib import Path

    b = dev_backend
    source = b.directory / "incoming"
    source.mkdir(exist_ok=True)
    contents = [PLY, b"ply\nformat ascii 1.0\ncomment preview\nend_header\n"]
    files = [source / "full.ply", source / "preview.ply"]
    for path, data in zip(files, contents, strict=True):
        path.write_bytes(data)
    job = b.request("POST", "/api/v1/jobs", 201).json()
    helper = Path(__file__).resolve().parents[2] / "backend/examples/make_job_completion.py"
    generated = subprocess.run(
        [
            sys.executable,
            str(helper),
            "--job-id",
            job["id"],
            "--source-root",
            str(source),
            "--name",
            "Two PLY representations",
            *map(str, files),
        ],
        capture_output=True,
        text=True,
        check=True,
        timeout=10,
    )
    payload = json.loads(generated.stdout)
    assert enqueue(b, payload)["status"] == "succeeded"
    completed = b.request("GET", f"/api/v1/jobs/{job['id']}").json()
    assert completed["completed_at"] is not None and len(completed["assets"]) == 1
    asset = completed["assets"][0]
    assert asset["primary_file_id"] == "file-1"
    assert [file["format"] for file in asset["files"]] == ["ply", "ply"]
    for file, expected in zip(asset["files"], contents, strict=True):
        assert b.request("GET", file["download_url"]).content == expected
    assert [path.read_bytes() for path in files] == contents
