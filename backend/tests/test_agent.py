from types import SimpleNamespace

from camera_path.agent import TrajectoryAgent
from camera_path.models import Project
from camera_path.repository import SQLiteProjectRepository


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
    agent = TrajectoryAgent(repository, "test-model", api_key="test")

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
