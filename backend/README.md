# Camera Path backend

Async Python backend for authoring semantic 3D camera trajectories. It stores path anchors,
Catmull–Rom and spiral segments, world-space camera targets, a speed graph and a camera-direction
graph. Every path is compiled to a client-neutral sequence of cubic Bézier curves.

MCP is intentionally not part of this version. The model calls narrow in-process tools through
the OpenAI Responses API. The agent receives saved conversation history and current project state,
then atomically creates, updates or deletes individual objects.

Projects, scene data, trajectory controls, chat history, and undo/redo snapshots are stored in
SQLite at `~/.camera-path/camera_path.sqlite3` by default. Set `CAMERA_PATH_DATABASE_PATH` to use
another file. Projects therefore survive backend restarts during development.

The HTTP layer depends only on `TrajectoryService`. Persistence is hidden behind the
`ProjectRepository` protocol, whose current implementation is `SQLiteProjectRepository`. This
keeps database choices and transactions out of controllers and the trajectory agent. Tests inject
a repository backed by a temporary database through `create_app()`.

## Run

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn camera_path.api:app --reload
```

Open <http://127.0.0.1:8000/docs> for the interactive API. The backend loads configuration from
`backend/.env`. Geometry and REST endpoints work without an API key. Set `OPENAI_API_KEY` in that
file only for the chat endpoints.

## Test

```bash
cd backend
uv run pytest
uv run ruff check .
```

## Populate development data

Create two ready-to-use projects for frontend development: one random spline and one random
spiral. Both include anchors, a scene target, speed keys and a camera key. The default seed is
deterministic, and rerunning the command with the same seed does not create duplicates.

```bash
cd backend
uv run db-populate
```

Use another seed to create another pair of demo projects:

```bash
uv run db-populate --seed 17
```

## Trajectory controls

Both control graphs use `path_position` in normalized arc length: `0` is the beginning of the
compiled trajectory and `1` is its end. This keeps keyframes stable if the path is resampled.
The compiled arc-length table adaptively samples every cubic Bézier according to
`CAMERA_PATH_COMPILE_TOLERANCE`, allowing the client to map distance to each curve's parameter.

The motion profile has a positive `default_speed` in metres per second. With no keys the camera
moves at that constant speed. A speed key stores a speed and one transition to the following key:

- `smoothstep` makes a smooth S-shaped transition;
- `linear` changes speed linearly;
- `hold` keeps the current speed, then jumps at the following key.

The compiler integrates reciprocal speed over the path and returns `duration_seconds`; it does not
mistake average speed for average travel time.

A camera key contains either `follow_path` (forward or backward tangent) or `look_at_point`, which
references an independently editable world-space scene point. The compiled payload resolves scene
point ids to positions. At runtime, the client computes each endpoint view direction, interpolates
them with the key transition weight, normalizes the result, and constructs orientation using
`world_up`. This allows a smooth blend from following the trajectory to looking at an object.

## REST workflow

1. Create a project with `POST /projects`.
   Use `GET /projects` to restore the project list after an application restart.
2. Add lifted path anchors with `POST /projects/{id}/anchors`.
3. Add spline or spiral segments, or delete one with `DELETE /projects/{id}/segments/{segment_id}`.
4. Manage look targets under `/projects/{id}/scene-points`.
5. Set baseline speed with `PATCH /projects/{id}/motion` and manage its keys under
   `/projects/{id}/motion/keyframes`.
6. Set the baseline aim with `PATCH /projects/{id}/camera` and manage direction keys under
   `/projects/{id}/camera/keyframes`.
7. Fetch `/projects/{id}/trajectory/compiled` for Bézier geometry, duration and sorted control keys.
8. Rename a project with `PATCH /projects/{id}` or delete it with `DELETE /projects/{id}`.
9. Start a new chat with `DELETE /projects/{id}/chat`. This preserves scene and trajectory data.
10. Clear only generated trajectory segments and control graphs with `DELETE
    /projects/{id}/trajectory`; anchors and scene points remain available.
11. Reset all scene, trajectory, and chat state while preserving the project id and name with
    `POST /projects/{id}/reset`.

Deleting a referenced scene point returns `409` unless `?cascade=true` is supplied; cascade also
deletes its camera keys. All mutations participate in the existing revision history and undo/redo.
SQLite stores each project revision as a validated JSON snapshot behind the repository boundary.

## Streaming chat

`POST /projects/{id}/chat/messages/stream` accepts the same JSON body as the regular chat endpoint
and returns `text/event-stream`. It is intended to be consumed with streaming `fetch()` because
native `EventSource` cannot send a POST body.

- `delta` events contain `{ "text": "..." }` as model tokens arrive;
- the final `result` event contains the complete `ChatResult`, including the committed project and
  compiled trajectory;
- an `error` event reports failures that happen after streaming response headers were sent.

The existing non-streaming `POST /projects/{id}/chat/messages` remains available.
