# Camera Path backend

Async Python backend for authoring semantic 3D camera trajectories. It stores path anchors,
Catmull–Rom and spiral segments, world-space camera targets, a speed graph, a camera-direction
graph and a local orientation track. Every path is compiled to a client-neutral sequence of cubic
Bézier curves.

MCP is intentionally not part of this version. The model calls narrow in-process tools through
the OpenAI Responses API. The agent receives saved conversation history and current project state,
then atomically creates, updates or deletes individual objects.

Projects, anchors, scene points, trajectory segments, timelines, and chat messages are stored in
separate SQLAlchemy tables. Small polymorphic resource values remain JSON payloads inside their
own rows, while ownership, order, and references are relational. Development uses SQLite at
`~/.camera-path/camera_path.sqlite3` by default, preserving the previous backend location. Set
`CAMERA_PATH_DATABASE_URL` to another async SQLAlchemy URL.

The HTTP routers depend on domain-specific services. Each resource repository combines its
contract and SQLAlchemy implementation in one class. The compatibility `ProjectRepository`
assembles the legacy aggregate while the frontend migrates to resource requests.
Declarative ORM records live separately from the Pydantic domain/API models. Tests inject a
repository backed by a temporary database through `create_app()`.

## Run

```bash
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn camera_path.api:app --reload
```

For a different development database:

```bash
CAMERA_PATH_DATABASE_URL=sqlite+aiosqlite:////absolute/path/camera_path.sqlite3 \
  uv run alembic upgrade head
```

The second migration reads the current snapshot from the previous `projects` /
`project_snapshots` schema and writes it into normalized resource tables. Older undo/redo stacks
are intentionally discarded; CP-41 and CP-42 introduce the replacement command-based history.

Open <http://127.0.0.1:8000/docs> for the Scalar API reference. The generated OpenAPI document is
served at <http://127.0.0.1:8000/api/v1/openapi.json>. The backend loads configuration from
`backend/.env`. Geometry and REST endpoints work without an API key. Set `OPENAI_API_KEY` in that
file only for the chat endpoints.

The canonical API is mounted at `/api/v1` and returns project metadata or one resource, never a
full `Project` snapshot. Existing unversioned URLs remain temporarily available for the frontend
as aggregate legacy endpoints and are hidden from OpenAPI. Read responses for one project include
an `ETag` containing its revision, for example `"4"`. Send that value in `If-Match` when mutating
the canonical API; a stale value returns `409`, and an omitted value returns `428`. Legacy aliases
do not require `If-Match`.

FastAPI route declarations and Pydantic models are the source of truth. Regenerate the checked-in
schema artifact after changing the API contract:

```bash
cd backend
uv run openapi-export openapi.json
```

### Frontend invalidation contract

Every project resource carries the same project revision ETag. When parallel reads return
different revisions, refetch only responses whose ETag is older than the highest observed value.
After a successful mutation, invalidate these resources:

| Mutation | Resources to refetch |
| --- | --- |
| Project metadata | project metadata |
| Anchors | anchors, compiled trajectory |
| Scene points | scene points, compiled trajectory |
| Trajectory segments | editable trajectory, compiled trajectory |
| Speed timeline | speed timeline, compiled trajectory |
| Aim timeline | aim timeline, compiled trajectory |
| Orientation timeline | orientation timeline, compiled trajectory |
| Depth-of-field timeline | depth-of-field timeline, compiled trajectory |
| Chat message/history | chat messages |
| Agent command or project reset | all project resources |

## Test

```bash
cd backend
uv run pytest
uv run ruff check .
```

## Populate development data

Create three ready-to-use projects for frontend development: one random spline, one random spiral,
and a mixed spline → spiral → spline path that exercises smooth semantic junctions. All include
anchors, a scene target, speed keys and a camera key. The default seed is deterministic, and
rerunning the command with the same seed does not create duplicates.

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

Spline and spiral primitives remain separate authoring objects, but compilation performs a global
smoothing pass over their connected boundaries. Each shared junction keeps its exact anchor while
the incoming and outgoing Bézier handles receive one common world-space tangent and magnitude.
Only a small subdivided neighborhood is deformed, with its displacement bounded by
`CAMERA_PATH_COMPILE_TOLERANCE`; the untouched interior retains the semantic spline or spiral
shape. Bézier lengths and the adaptive arc-length table are computed after this final smoothing.

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

The aim track chooses that base view direction. The separate orientation track applies local
offsets on top of its frame in this fixed order: `yaw_deg` around local up, `pitch_deg` around local
right, then `roll_deg` around the view axis. API and storage values are degrees and remain
unwrapped: interpolating yaw from `0` to `360` means one full turn. `linear` and `smoothstep`
interpolate each of the three scalar angles; `hold` keeps the left key's angles until the next key.
The backend validates and sorts these semantic controls; the frontend/runtime constructs the final
quaternion.

## REST workflow

1. Create a project with `POST /api/v1/projects` and restore project metadata with
   `GET /api/v1/projects`.
2. Load anchors, scene points, editable trajectory, each timeline, and chat messages with separate
   requests. All project resource responses carry the same project-level `ETag`.
3. Add lifted path anchors with `POST /api/v1/projects/{id}/anchors`.
4. Add spline or spiral segments, or delete one under `/api/v1/projects/{id}/segments`.
5. Manage look targets under `/api/v1/projects/{id}/scene-points`.
6. Manage speed, aim, orientation, and depth-of-field through their separate timeline resources.
7. Set baseline yaw, pitch and roll with
   `PATCH /api/v1/projects/{id}/camera/orientation`:

   ```json
   {
     "path_position": 0.5,
     "orientation": {"yaw_deg": 360, "pitch_deg": -10, "roll_deg": 5},
     "interpolation_to_next": "smoothstep"
   }
   ```

8. Fetch `/api/v1/projects/{id}/trajectory/compiled` for derived playback geometry.
9. Rename or delete the project through `/api/v1/projects/{id}`.
10. Clear chat with `DELETE /api/v1/projects/{id}/chat`.
11. Clear trajectory and timeline resources with
    `DELETE /api/v1/projects/{id}/trajectory`.
12. Reset all resources while preserving project identity with
    `POST /api/v1/projects/{id}/reset`.

Deleting a referenced scene point returns `409` unless `?cascade=true` is supplied; cascade also
deletes its camera keys. Mutations advance one shared project revision. Undo/redo is intentionally
absent from CP-40.

## Streaming chat

`POST /api/v1/projects/{id}/chat/messages/stream` accepts the same JSON body as the regular chat endpoint
and returns `text/event-stream`. It is intended to be consumed with streaming `fetch()` because
native `EventSource` cannot send a POST body.

- `delta` events contain `{ "text": "..." }` as model tokens arrive;
- the final `result` event contains the answer and compiled trajectory; clients refetch invalidated
  resources through the shared project revision;
- an `error` event reports failures that happen after streaming response headers were sent.

The non-streaming `/api/v1/projects/{id}/chat/messages` returns the same resource-oriented result.
Unversioned aggregate chat endpoints remain temporarily available for CP-39 migration.
