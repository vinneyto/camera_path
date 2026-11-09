"""Chat -> library -> RabbitMQ -> model -> scene, using only local peers."""

import base64
import json

from test_generation import completion, configure
from test_job_completion import wait_job

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEUlEQVR4nGP8zwAFTDAGEgsAHVsBBeg3qMUAAAAASUVORK5CYII="
)


def test_chat_image_job_replaces_selected_anchor_after_restart(dev_backend):
    b = dev_backend
    b.stop()
    configure(b, b.broker.url)
    b.start()
    p = b.project("Chat image reconstruction")
    anchor = p.anchor()
    p.mutate("PATCH", f"/anchors/{anchor['id']}", json={"lift": 4})
    image = p.mutate(
        "POST",
        "/chat/attachments",
        201,
        json={"name": "chair.png", "format": "png", "size_bytes": len(PNG)},
    ).json()
    b.request("PUT", image["upload_url"], 204, content=PNG)
    attachment = p.mutate("POST", f"/chat/attachments/{image['id']}/complete").json()
    assert b.request("GET", attachment["url"]).content == PNG
    assert b.request("GET", "/api/v1/library").json() == []
    b.llm.mode = "scene_tools"
    b.llm.scene_tools = [
        ("create_library_asset", {"attachment_id": image["id"]}),
        (
            "start_image_generation",
            {
                "image_asset_id": image["id"],
                "replace_anchor_id": anchor["id"],
                "name": None,
            },
        ),
    ]
    response = p.mutate(
        "POST",
        "/chat/messages",
        json={
            "id": "image-replacement",
            "message": "Generate this image and replace it afterwards",
            "selected_object_id": f"anchor:{anchor['id']}",
            "attachment_ids": [image["id"]],
        },
    )
    assert response.json()["answer"] == "Fixture answer"
    history = p.get("/chat/messages").json()
    assert history[0]["selected_object"]["resource_id"] == anchor["id"]
    assert history[0]["attachments"][0]["name"] == "chair.png"
    assert b.llm.requests[0]["input"][0]["content"][1]["type"] == "input_image"
    jobs = p.get("/generation-jobs").json()
    assert len(jobs) == 1 and jobs[0]["scene_placement"]["status"] == "pending"
    job = jobs[0]
    queue = b.env["CAMERA_PATH_GENERATION_REQUEST_QUEUE"]
    b.broker.wait_queue(queue)
    command = json.loads(b.broker.get_message(queue)["body"])
    assert command["job_id"] == job["id"] and "image_path" in command["input"]
    result = completion(b, {"id": job["id"], "input": command["input"]})
    b.stop()
    b.start()
    b.broker.publish(b.env["CAMERA_PATH_GENERATION_RESULT_QUEUE"], result)
    finished = wait_job(b, job["id"])
    assert finished["status"] == "succeeded"
    assert finished["scene_placement"]["status"] == "succeeded"
    assert p.get("/anchors").json() == []
    objects = p.get("/scene-objects").json()
    assert len(objects) == 1 and objects[0]["scale"] == [1, 1, 1]
    assert objects[0]["position"] == [0, 2, 0]
    assert len(b.request("GET", "/api/v1/library").json()) == 2
    # Preserve the uploaded original and only replace the placeholder in the scene.
    assert b.request("GET", attachment["url"]).content == PNG
    assert (
        p.get("/generation-jobs").json()[0]["scene_placement"]["scene_object_id"]
        == objects[0]["id"]
    )
