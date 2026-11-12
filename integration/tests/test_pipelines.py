"""Persisted execution and SSE over a real HTTP connection, without an agent key."""

import json
import time


def wait_pipeline(p, pipeline_id=None, *, waiting=False):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        rows = p.get("/pipelines").json()
        for row in rows:
            if pipeline_id and row["id"] != pipeline_id:
                continue
            if row["status"] in {"succeeded", "failed"} or (
                waiting and any(s["status"] == "waiting" for s in row["steps"])
            ):
                return row
        time.sleep(0.05)
    raise AssertionError("Pipeline did not reach expected state")


def test_pipeline_confirmation_steps_sse_replay_and_restart(editor):
    p = editor.project()
    p.mutate(
        "POST",
        "/chat/user-messages",
        201,
        json={"id": "pipeline-message", "message": "Prepare two speed edits"},
    )
    payload = {
        "message_id": "pipeline-message",
        "definition": {
            "title": "Two speed edits",
            "start_mode": "wait_for_confirmation",
            "steps": [
                {"id": "first", "command": "set_default_speed", "input": {"speed": 2.5}},
                {"id": "second", "command": "set_default_speed", "input": {"speed": 3.5}},
            ],
        },
    }
    pipeline = p.mutate("POST", "/pipelines", 201, json=payload).json()
    pipeline_id = pipeline["id"]
    assert pipeline["status"] == "awaiting_confirmation"
    assert p.mutate("POST", "/pipelines", 201, json=payload).json()["id"] == pipeline_id
    assert p.get(f"/pipelines/{pipeline_id}").json()["definition"] == pipeline["definition"]
    p.mutate("POST", f"/pipelines/{pipeline_id}/confirm")
    result = wait_pipeline(p, pipeline_id)
    assert result["status"] == "succeeded"
    assert p.get("/motion").json()["default_speed"] == 3.5
    p.mutate("POST", f"/pipelines/{pipeline_id}/confirm")
    with editor.client.stream(
        "GET", p.path + "/pipelines/events", headers={"Last-Event-ID": "0"}
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        event_name, cursor, completed = None, None, []
        for line in response.iter_lines():
            if line.startswith("id: "):
                cursor = int(line[4:])
            elif line.startswith("event: "):
                event_name = line[7:]
            elif line.startswith("data: ") and event_name == "pipeline":
                event = json.loads(line[6:])
                steps = event["pipeline"]["steps"]
                if event["step_id"] and any(
                    s["id"] == event["step_id"] and s["status"] == "succeeded" for s in steps
                ):
                    completed.append(event["step_id"])
                if event["pipeline"]["status"] == "succeeded":
                    break
        assert completed == ["first", "second"] and cursor
    editor.stop()
    editor.start()
    assert p.get(f"/pipelines/{pipeline_id}").json() == result
    invalid = {
        **payload,
        "definition": {
            **payload["definition"],
            "steps": [{"id": "bad", "command": "run_python", "input": {}}],
        },
    }
    p.mutate("POST", "/pipelines", 422, json=invalid)
