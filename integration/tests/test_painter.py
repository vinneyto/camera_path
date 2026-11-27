"""Painter's real broker/API contract, using a tiny PNG in place of ML inference."""

import base64
import hashlib
import json
from pathlib import Path

from test_job_completion import wait_job

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8AARAxgEswAACvmA/0Sp46gAAAAAElFTkSuQmCC"
)


def test_painter_result_survives_backend_restart_and_imports_once(dev_backend):
    b = dev_backend
    b.stop()
    b.env.update(
        {
            "CAMERA_PATH_IMAGE_GENERATION_PROVIDER": "painter",
            "CAMERA_PATH_PAINTER_OUTPUT_DIRECTORY": str(b.directory / "painter"),
            "CAMERA_PATH_PAINTER_REQUEST_QUEUE": b.queue_name + "-paint",
            "CAMERA_PATH_PAINTER_RESULT_QUEUE": b.queue_name + "-painted",
        }
    )
    b.start()
    source = b.request(
        "POST",
        "/api/v1/library/uploads",
        201,
        json={
            "name": "Original.png",
            "format": "png",
            "size_bytes": len(PNG),
        },
    ).json()
    b.request("PUT", source["upload_url"], 204, content=PNG)
    b.request("POST", f"/api/v1/library/{source['id']}/complete")
    job = b.request(
        "POST",
        "/api/v1/jobs",
        201,
        json={
            "type": "image_generation",
            "start": True,
            "input": {"prompt": "Make the chair blue", "image_asset_id": source["id"]},
        },
    ).json()
    b.request("DELETE", f"/api/v1/library/{source['id']}", 409)
    requests = b.env["CAMERA_PATH_PAINTER_REQUEST_QUEUE"]
    results = b.env["CAMERA_PATH_PAINTER_RESULT_QUEUE"]
    b.broker.wait_queue(requests)
    message = b.broker.get_message(requests)
    assert message["properties"]["correlation_id"] == job["id"]
    command = json.loads(message["body"])
    assert command["job_id"] == job["id"] and command["schema_version"] == 1
    parameters = command["input"]
    assert parameters["prompt"] == "Make the chair blue"
    assert parameters["model"] == "black-forest-labs/FLUX.2-klein-4B"
    assert Path(parameters["image_path"]).read_bytes() == PNG
    assert parameters["image_sha256"] == hashlib.sha256(PNG).hexdigest()
    event = {"schema_version": 1, "job_id": job["id"]}
    b.broker.publish(results, {**event, "status": "running"})
    b.stop()
    directory = b.directory / "painter" / job["id"]
    directory.mkdir()
    (directory / "image.png").write_bytes(PNG)
    (directory / "result.json").write_text(
        json.dumps(
            {
                **event,
                "input": parameters,
                "image_path": f"{job['id']}/image.png",
                "size_bytes": len(PNG),
                "sha256": hashlib.sha256(PNG).hexdigest(),
            }
        )
    )
    success = {**event, "status": "succeeded", "result_path": f"{job['id']}/result.json"}
    b.broker.publish(results, success)
    # New jobs are disabled; the saved job must still finish with its original provider.
    b.env["CAMERA_PATH_IMAGE_GENERATION_PROVIDER"] = "none"
    b.start()
    done = wait_job(b, job["id"])
    assert done["status"] == "succeeded" and len(done["assets"]) == 1
    path = f"/api/v1/jobs/{job['id']}"
    assert b.request("GET", path + "/image", auth=False).content == PNG
    assert b.request("GET", path + "/source-image", auth=False).content == PNG
    b.broker.publish(results, success)
    barrier = b"painter-replay-barrier"
    b.broker.publish(results, barrier)
    assert b.broker.get_failure(results)["body"] == barrier
    assert len(b.request("GET", path).json()["assets"]) == 1
    b.request("DELETE", f"/api/v1/library/{source['id']}", 204)
    b.request("GET", path + "/source-image", 404, auth=False)
