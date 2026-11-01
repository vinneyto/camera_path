"""Real HTTP + email login + queue worker, with test-owned model files only."""

import copy
import hashlib
import json
import os
import time
from uuid import uuid4

import pytest

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


def wait_job(b, job_id):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        job = b.request("GET", f"/api/v1/jobs/{job_id}", auth=False).json()
        if job["completed_at"] is not None:
            return job
        time.sleep(0.05)
    raise AssertionError("Job did not complete after RabbitMQ publication")


def enqueue(b, payload):
    b.broker.publish(b.queue_name, payload)
    job = wait_job(b, payload["job_id"])
    # This single RabbitMQ consumer has prefetch=1. A later delivery is a barrier
    # proving the preceding completion/replay was settled, even for completed jobs.
    barrier = f"settlement-barrier-{uuid4()}".encode()
    b.broker.publish(b.queue_name, barrier)
    assert b.broker.get_failure(b.queue_name)["body"] == barrier
    return job


def test_rabbitmq_completion_multiple_files_and_restart(dev_backend):
    b = dev_backend
    data = descriptor(b)
    job = enqueue(b, data)
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
    assert wait_job(b, job["id"]) == job
    replay = copy.deepcopy(data)
    replay["message_id"] = str(uuid4())
    (b.directory / "incoming/tree.ply").unlink()
    assert enqueue(b, replay) == job
    assert b.request("GET", f"/api/v1/jobs/{job['id']}").json() == job
    assert len(b.request("GET", "/api/v1/library").json()) == 1
    b.request("DELETE", f"/api/v1/library/{asset['id']}", 204)
    assert not (b.directory / "library/tree.sog").exists() and not external_copies[0].exists()
    replay["message_id"] = str(uuid4())
    enqueue(b, replay)
    deleted = b.request("GET", f"/api/v1/jobs/{job['id']}").json()
    assert deleted["completed_at"] == job["completed_at"] and deleted["assets"] == []


def test_rabbitmq_bad_files_are_quarantined_without_partial_results(dev_backend):
    b = dev_backend
    data = descriptor(b)
    data["assets"][0]["files"][1]["sha256"] = "0" * 64
    b.broker.publish(b.queue_name, data)
    failure = b.broker.get_failure(b.queue_name)
    assert failure["properties"]["headers"]["error_code"] == "library_import_invalid_file"
    assert json.loads(failure["body"]) == data
    assert b.request("GET", "/api/v1/library").json() == []
    job = b.request("GET", f"/api/v1/jobs/{data['job_id']}").json()
    assert job["completed_at"] is None and job["assets"] == []
    assert (b.directory / "library/tree.sog").read_bytes() == SOG
    assert not list((b.directory / "library").glob("*.ply"))


def test_rabbitmq_rejects_malformed_and_oversized_messages(dev_backend):
    b = dev_backend
    for body in [b"not json", b"\xff", b" " * (256 * 1024 + 1), b'{"schema_version":1,"item":{}}']:
        b.broker.publish(b.queue_name, body)
        failure = b.broker.get_failure(b.queue_name)
        assert failure["body"] == body
        assert failure["properties"]["headers"]["error_code"] == "validation_error"
    assert b.request("GET", "/api/v1/library").json() == []


def test_debug_routes_are_absent_with_rabbitmq(dev_backend):
    backend = dev_backend
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
    b.broker.publish(b.queue_name, payload)
    failure = b.broker.get_failure(b.queue_name)
    assert failure["properties"]["headers"]["error_code"] == "job_not_found"
    b.request("GET", f"/api/v1/jobs/{payload['job_id']}", 404)


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
    assert enqueue(b, payload)["completed_at"] is not None
    completed = b.request("GET", f"/api/v1/jobs/{job['id']}").json()
    assert completed["completed_at"] is not None and len(completed["assets"]) == 1
    asset = completed["assets"][0]
    assert asset["primary_file_id"] == "file-1"
    assert [file["format"] for file in asset["files"]] == ["ply", "ply"]
    for file, expected in zip(asset["files"], contents, strict=True):
        assert b.request("GET", file["download_url"]).content == expected
    assert [path.read_bytes() for path in files] == contents


def test_completion_is_durable_across_backend_and_broker_restart(dev_backend):
    b = dev_backend
    data = descriptor(b)
    b.stop()
    b.broker.publish(b.queue_name, data)
    b.broker.restart()
    b.start()
    job = wait_job(b, data["job_id"])
    assert len(job["assets"]) == 1 and len(job["assets"][0]["files"]) == 2
    assert b.request("GET", job["assets"][0]["download_url"]).content == SOG


def test_running_backend_reconnects_after_broker_restart(dev_backend):
    b = dev_backend
    data = descriptor(b)
    b.broker.restart()
    assert b.request("GET", "/health", auth=False).json() == {"status": "ok"}
    assert len(enqueue(b, data)["assets"]) == 1


@pytest.mark.skipif(os.geteuid() == 0, reason="Root bypasses source-file permissions")
def test_temporary_source_failure_retries_without_blocking_other_jobs(dev_backend):
    b = dev_backend
    data = descriptor(b)
    source = b.directory / "incoming/tree.ply"
    source.chmod(0)
    try:
        # Start at attempt 3 so the real retry's four-second TTL leaves time to
        # prove another job can finish while this source remains inaccessible.
        b.broker.publish(b.queue_name, data, headers={"camera-path-attempt": 3})
        retry = b.broker.get_message(b.queue_name + ".retry.4", requeue=True)
        assert json.loads(retry["body"]) == data
        assert retry["properties"]["headers"]["camera-path-attempt"] == 4
        other = copy.deepcopy(data)
        other["job_id"] = b.request("POST", "/api/v1/jobs", 201).json()["id"]
        other["message_id"] = str(uuid4())
        other["assets"][0]["files"] = [other["assets"][0]["files"][1]]
        other["assets"][0]["primary_file_id"] = "ply"
        other["assets"][0]["files"][0]["source"]["path"] = "other.ply"
        (b.directory / "incoming/other.ply").write_bytes(PLY)
        b.broker.publish(b.queue_name, other)
        assert wait_job(b, other["job_id"])["completed_at"] is not None
        assert b.request("GET", f"/api/v1/jobs/{data['job_id']}").json()["assets"] == []
    finally:
        source.chmod(0o600)
    assert len(wait_job(b, data["job_id"])["assets"]) == 1


@pytest.mark.skipif(os.geteuid() == 0, reason="Root bypasses source-file permissions")
def test_exhausted_temporary_failure_is_quarantined(dev_backend):
    b = dev_backend
    b.stop()
    b.env["CAMERA_PATH_MESSAGE_QUEUE_MAX_ATTEMPTS"] = "2"
    b.start()
    data = descriptor(b)
    source = b.directory / "incoming/tree.ply"
    source.chmod(0)
    try:
        b.broker.publish(b.queue_name, data)
        failure = b.broker.get_failure(b.queue_name)
    finally:
        source.chmod(0o600)
    assert json.loads(failure["body"]) == data
    assert failure["properties"]["headers"]["error_code"] == "library_import_unavailable"
    job = b.request("GET", f"/api/v1/jobs/{data['job_id']}").json()
    assert job["completed_at"] is None and job["assets"] == []
