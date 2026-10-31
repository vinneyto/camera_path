import json


def test_user_messages_idempotency_conflict_and_clear(editor):
    p = editor.project()
    payload = {"id": "user-fixture", "message": "Keep my scene"}
    first = p.mutate("POST", "/chat/user-messages", 201, json=payload)
    revision = p.get().headers["etag"]
    assert p.mutate("POST", "/chat/user-messages", 201, json=payload).json() == first.json()
    assert p.get().headers["etag"] == revision
    p.mutate("POST", "/chat/user-messages", 409, json={**payload, "message": "Different"})
    assert p.get("/chat/messages").json() == [first.json()]
    a = p.anchor()
    p.mutate("DELETE", "/chat", 204)
    assert p.get("/chat/messages").json() == []
    assert p.get("/anchors").json() == [a]


def test_agent_calls_external_http_peer_executes_tool_and_persists_history(editor):
    b = editor
    b.llm.mode = "tool"
    p = b.project()
    a = p.anchor()
    r = p.mutate("POST", "/chat/messages", json={"id": "agent-fixture", "message": "Set speed"})
    assert r.json()["answer"] == "Fixture answer"
    assert "compiled" in r.json()
    assert len(b.llm.requests) == 2
    assert p.get("/motion").json()["default_speed"] == 2.5
    assert p.get("/anchors").json() == [a]
    history = p.get("/chat/messages").json()
    assert [x["role"] for x in history] == ["user", "assistant"]
    assert history[1]["content"] == "Fixture answer"
    b.stop()
    b.start()
    assert p.get("/chat/messages").json() == history


def test_sse_delta_result_and_headers(editor):
    b = editor
    p = b.project()
    response = p.mutate(
        "POST", "/chat/messages/stream", json={"id": "stream-fixture", "message": "Answer"}
    )
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"
    events = []
    for frame in response.text.strip().split("\n\n"):
        lines = frame.splitlines()
        events.append(
            (lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: ")))
        )
    assert events[0] == ("delta", {"text": "Fixture answer"})
    assert events[-1][0] == "result" and events[-1][1]["answer"] == "Fixture answer"
    assert "project" not in events[-1][1] and "compiled" in events[-1][1]
    assert len(p.get("/chat/messages").json()) == 2


def test_external_api_failure_and_truncated_stream_are_visible(editor):
    b = editor
    p = b.project()
    a = p.anchor()
    b.llm.mode = "failure"
    r = p.mutate("POST", "/chat/messages", 502, json={"id": "failure-fixture", "message": "Fail"})
    assert r.json()["code"] == "upstream_error"
    b.llm.mode = "truncated"
    r = p.mutate(
        "POST", "/chat/messages/stream", json={"id": "truncated-fixture", "message": "Truncate"}
    )
    assert "event: error" in r.text and "stream_error" in r.text
    assert "event: result" not in r.text
    assert p.get("/anchors").json() == [a]
