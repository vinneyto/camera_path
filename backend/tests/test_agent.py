from types import SimpleNamespace

from camera_path.agent import TrajectoryAgent
from camera_path.models import Project
from camera_path.repository import SQLiteProjectRepository
from camera_path.service import TrajectoryService


async def test_agent_persists_conversation_context(monkeypatch, tmp_path) -> None:
    calls = []

    class Responses:
        async def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(output=[], output_text=f"answer {len(calls)}")

    monkeypatch.setattr(
        "camera_path.agent.AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )
    repository = SQLiteProjectRepository(tmp_path / "state.sqlite3")
    project = await repository.create(Project())
    agent = TrajectoryAgent(TrajectoryService(repository), "test-model", api_key="test")

    first = await agent.handle(project.id, "first request")
    second = await agent.handle(project.id, "second request")

    assert [item.content for item in second.project.chat_history] == [
        "first request",
        "answer 1",
        "second request",
        "answer 2",
    ]
    assert calls[1]["input"][:2] == [
        {"role": "user", "content": "first request"},
        {"role": "assistant", "content": "answer 1"},
    ]
    assert first.project.revision == 1
    assert second.project.revision == 2


async def test_agent_returns_tool_errors_to_model(monkeypatch, tmp_path) -> None:
    calls = []

    class Responses:
        async def create(self, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                tool_call = SimpleNamespace(
                    type="function_call",
                    name="delete_segment",
                    arguments='{"id":"missing"}',
                    call_id="call-1",
                )
                return SimpleNamespace(output=[tool_call], output_text="")
            return SimpleNamespace(output=[], output_text="Nothing was deleted")

    monkeypatch.setattr(
        "camera_path.agent.AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )
    repository = SQLiteProjectRepository(tmp_path / "state.sqlite3")
    project = await repository.create(Project())
    agent = TrajectoryAgent(TrajectoryService(repository), "test-model", api_key="test")

    result = await agent.handle(project.id, "Delete the missing segment")

    tool_output = calls[1]["input"][-1]
    assert '"status": "error"' in tool_output["output"]
    assert result.answer == "Nothing was deleted"
    assert result.project.segments == []


async def test_agent_streams_text_and_persists_result(monkeypatch, tmp_path) -> None:
    completed_response = SimpleNamespace(output=[], output_text="hello")

    class Stream:
        def __aiter__(self):
            async def events():
                yield SimpleNamespace(type="response.output_text.delta", delta="hel")
                yield SimpleNamespace(type="response.output_text.delta", delta="lo")
                yield SimpleNamespace(type="response.completed", response=completed_response)

            return events()

    class Responses:
        async def create(self, **kwargs):
            assert kwargs["stream"] is True
            return Stream()

    monkeypatch.setattr(
        "camera_path.agent.AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )
    repository = SQLiteProjectRepository(tmp_path / "state.sqlite3")
    project = await repository.create(Project())
    agent = TrajectoryAgent(TrajectoryService(repository), "test-model", api_key="test")

    events = [event async for event in agent.handle_stream(project.id, "Say hello")]

    assert events[0] == {"type": "delta", "text": "hel"}
    assert events[1] == {"type": "delta", "text": "lo"}
    assert events[2]["type"] == "result"
    assert events[2]["result"].answer == "hello"
