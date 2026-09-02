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

## Run

```bash
cd backend
uv sync
uv run uvicorn camera_path.api:app --reload
```

Open <http://127.0.0.1:8000/docs> for the interactive API. Geometry and REST endpoints work
without an API key. Set `OPENAI_API_KEY` only for
`POST /projects/{project_id}/chat/messages`.

## Test

```bash
cd backend
uv run pytest
uv run ruff check .
```

## Trajectory controls

Both control graphs use `path_position` in normalized arc length: `0` is the beginning of the
compiled trajectory and `1` is its end. This keeps keyframes stable if the path is resampled.

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

Deleting a referenced scene point returns `409` unless `?cascade=true` is supplied; cascade also
deletes its camera keys. All mutations participate in the existing revision history and undo/redo.
SQLite stores each project revision as a validated JSON snapshot behind the repository boundary.
