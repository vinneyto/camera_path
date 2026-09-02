# Camera Path backend

Async Python backend for authoring semantic 3D camera trajectories. The server stores user
anchors, builds Catmull–Rom and spiral segments, and compiles every path to a client-neutral
sequence of cubic Bézier curves.

MCP is intentionally not part of the first version. The language model calls narrow in-process
function tools through the OpenAI Responses API; the same service boundary can later be exposed
through MCP without changing the geometry core or frontend API.

## Run

```bash
uv sync
uv run uvicorn camera_path.api:app --reload
```

Open <http://127.0.0.1:8000/docs> for the interactive API. The geometry and REST endpoints work
without an API key. Set `OPENAI_API_KEY` only to use `POST /projects/{project_id}/chat/messages`.

## Test

```bash
uv run pytest
uv run ruff check .
```

## Core workflow

1. Create a project with `POST /projects`.
2. Add anchors with `POST /projects/{id}/anchors`. An anchor's effective position is its surface
   hit plus `lift` along world-up (or its stored surface normal).
3. Add spline or spiral segments.
4. Fetch `/projects/{id}/trajectory/compiled`; the frontend only receives cubic Bézier segments
   and an arc-length lookup table.
5. Use undo/redo or ask the chat agent to edit the semantic trajectory atomically.

Storage is deliberately in-memory in this MVP. `ProjectRepository` is an interface boundary for
a later SQLite/PostgreSQL implementation.

