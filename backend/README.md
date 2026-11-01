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

### Local 3DGS library

The library stores file metadata in the database and PLY bytes in
`~/.camera-path/library` by default. Set `CAMERA_PATH_LIBRARY_DIRECTORY` to choose another
directory. Keep this directory persistent across backend restarts. The local storage adapter
provides development upload and download routes. Storage access is behind `LibraryStorage`,
so API and library service code do not depend on
the storage implementation.

To upload a file, call `POST /api/v1/library/uploads` with its name and byte size, PUT the bytes
to the returned `upload_url`, then call `POST /api/v1/library/{id}/complete`. The final step checks
the uploaded size and PLY signature before the asset appears in `GET /api/v1/library` with a
`download_url`. Library assets are independent of projects; associating clouds with projects is
tracked separately. Preparing, uploading, confirming and deleting assets require an editor JWT;
downloading ready files remains public.

`DELETE /api/v1/library/{id}` removes the asset, its stored file and every cloud instance
that references it in every project. Remaining clouds retain their order with consecutive
positions, and each affected project's revision advances once. A storage deletion error
rolls back database changes so the request can be retried; missing file content is tolerated.
An unknown or already deleted asset returns 404. No database migration is required.

`POST /api/v1/library/bulk-delete` accepts `{"asset_ids": ["id-1", "id-2"]}` and deletes
the entire selection in one request. All IDs are validated before files are touched. Each
affected project advances its revision once for the whole batch. `LibraryStorage.stage_delete`
keeps recoverable content until SQL commit; the local adapter moves files to a temporary
directory on the same filesystem and restores them on staging or transaction failures.
The frontend uses checkboxes and Actions → Delete selected with a React confirmation dialog.

### S3 library with a local backend (M3-1)

Install the AWS extra with `uv sync --extra aws`. Add these values to `backend/.env`, alongside
your existing JWT/OpenAI configuration:

```dotenv
CAMERA_PATH_AWS_LIBRARY_STORAGE=s3
CAMERA_PATH_AWS_S3_BUCKET=camera-path-library-d9f856354df8-992382434156
CAMERA_PATH_AWS_S3_PREFIX=library/
CAMERA_PATH_AWS_REGION=us-east-1
```

The existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env` are read as secrets and
passed to Boto3; temporary credentials may also set `AWS_SESSION_TOKEN`. Alternatively set
`CAMERA_PATH_AWS_PROFILE=camera-path-backend-d9f856354df8` and omit explicit keys. With neither supplied,
Boto3 uses its standard credential chain, including an EC2 IAM role. Standard `AWS_REGION`, `AWS_DEFAULT_REGION` and `AWS_PROFILE` remain supported as fallbacks;
project-prefixed values take priority. No AWS credentials reach
the browser. Keep `.env` untracked.

Run `uv run --extra aws alembic upgrade head`, then
`uv run --extra aws uvicorn camera_path.api:app --reload`. Start the frontend normally, with its
server-side `CAMERA_PATH_BACKEND_URL=http://127.0.0.1:8000`. S3 mode does not mount the local
file-content routes. Set `CAMERA_PATH_AWS_LIBRARY_STORAGE=local` to use filesystem storage again.
Use a separate `CAMERA_PATH_DATABASE_URL` for the S3 trial: switching adapters does not migrate
existing local files, and the database stores keys, not the storage backend or temporary URLs.

The browser PUTs bytes directly to a SigV4 URL for `library/_uploads/<id>.ply`. Completion
checks the actual size and PLY signature using HeadObject and a four-byte range read, then
copies the inspected ETag to `library/<id>.ply`. The staging object is removed. An old upload
URL cannot overwrite the confirmed file. Completion is idempotent; if SQL fails after the
copy, the next attempt can recover the promoted object. Download URLs use the permanent key
and an attachment filename, including for guest viewing and project-cloud instances.
`CAMERA_PATH_AWS_S3_URL_TTL_SECONDS` defaults to 300 (60–3600). Refresh library/project metadata to
obtain fresh URLs after expiration; temporary AWS credentials may expire sooner.

The manually prepared bucket uses region `us-east-1`, disabled ACLs, Block Public Access and
SSE-S3. Bucket and backend IAM user carry `DeploymentId=d9f856354df8`. IAM needs GetObject,
PutObject and DeleteObject on `library/*`; ListBucket with a `library/*` prefix is useful for
the CLI smoke test. Server-side copy uses those same object permissions. Bucket CORS must
allow local frontend origins, GET/HEAD/PUT/POST and request headers, as configured in M3-1.

Deletion copies objects into `library/_delete/<operation-id>/` before removing live keys.
Staging or SQL failures restore them; backups are removed after commit. If restoration fails,
backups are retained for recovery. Cleanup failure after commit is logged without reporting a
failed deletion. A process crash can leave staging/backup objects: retain `_delete/` for manual
recovery and remove abandoned `_uploads/` only after their signed URLs expire. Replaying an
unexpired upload URL may recreate an unreferenced staging object. Automatic cleanup and upload
quotas are follow-up work in M3-5; this PR keeps the existing size limit and does not change
bucket lifecycle policies.

Local smoke check: sign in, upload a PLY, view it in a project, download as a guest, restart the
backend and reopen it, then delete as an editor (including bulk deletion). Verify that guest
upload/completion/deletion is rejected. AWS adapter tests run with
`uv run --extra aws pytest`; ordinary local tests can run without the extra.

### User profile settings

`GET /api/v1/profile/settings` returns the shared guest viewer profile: `webgpu_tile_renderer`
and `show_grid` default to true; `gaussian_dpr` defaults to `"1x"` and also accepts `"system"`.
Anonymous reads never create or update profile rows. `PATCH` requires an editor JWT and saves
only supplied fields; it publishes the confirmed values as the guest fallback. No project ETag
is required. `CAMERA_PATH_DEV_USER_ID` (default `dev-user`) retains the existing M2 profile key;
it does not identify the authenticated editor or scope projects/chat/library to an owner.
Viewer preferences are always saved in browser localStorage and take priority over backend values.
Guests can edit them locally; editor changes also publish the supplied fields to this backend profile.
Login, logout and session expiry preserve local preferences.

### Editor authentication

All reads of projects, resources, library files and chat history remain public. Every write route,
including legacy aliases, local PLY uploads and both agent endpoints, uses the common
`@authenticated` decorator below `@router.post/patch/put/delete(...)`. Anonymous or invalid JWT
writes return
401 before revision checks or side effects. `AuthenticatedRoute` adds the standard FastAPI dependency
when registering marked endpoints; the decorator leaves endpoint signatures unchanged. Data remains
shared between guest and editor.

Configure these routers with `APIRouter(route_class=AuthenticatedRoute)`. Decorators execute from
bottom to top: `@authenticated` marks the function first, then `@router...` registers the protected
endpoint. It does not wrap or call the route decorator.

Configure a random signing secret with at least 32 bytes in `backend/.env` (never commit it):

```bash
uv run python -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Set the printed value as `CAMERA_PATH_JWT_SECRET`, then prepare the database and single account:

```bash
uv run alembic upgrade head
uv run editor-create you@example.com
```

The command asks for a password twice (12–1024 characters), stores a salted Argon2 hash and
revokes all previous sessions when replacing credentials. There is no public registration API.
The new migration `20261006_0011` preserves project/library/profile data and adds editor sessions.
Missing/short signing secrets disable login and authenticated requests; public reads still work.

`POST /api/v1/auth/login` accepts JSON `{ "username": "you@example.com", "password": "..." }`
and returns an email challenge. `/api/v1/auth/verify` consumes the emailed code and returns
`access_token`, `token_type` and `expires_in` to direct API clients. In explicit development
off mode, login returns the token directly. Use `Authorization: Bearer ...`
for writes and `GET /api/v1/auth/session`. JWT validation fixes HS256 and checks signature, issuer,
audience, required claims, expiry and the active server session. Default lifetime is eight hours;
`CAMERA_PATH_JWT_TTL_SECONDS` accepts 60–86400 seconds. No refresh token is issued.
`POST /api/v1/auth/logout` revokes only the current session, so replaying that JWT fails immediately.
Sign-in and code delivery/check limits are persisted across backend processes and restarts
(see the email second factor section below). A request already authenticated/in flight may finish after logout.

The Next.js proxy stores the JWT in an HttpOnly, SameSite=Strict cookie (Secure in production),
adds Bearer authorization for the backend, and validates the Origin of every browser write.
The browser receives session metadata rather than the raw token. Cookies and JWTs are not in
localStorage. The same proxy works locally and on Vercel; only its server-side backend URL changes.

### Project clouds

Each project can reference several ready library PLY files through `project_clouds`. The project
cloud record stores the library asset ID, order and visibility; it never stores a download URL or
copies the file. `GET /api/v1/projects/{id}/clouds` resolves URLs through `LibraryStorage`.
`POST` to that path with `{"library_asset_id": "..."}` attaches a file, `PATCH /{cloud_id}` changes
`position` or `visible`, and `DELETE /{cloud_id}` removes only the project instance. Mutations
require the current project revision in `If-Match` and return a new project ETag. Resetting a
project clears its cloud instances but keeps the library files. Projects created before this
migration remain intact, with an initially empty cloud list.

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

[SPECS.md](SPECS.md) is the implementation contract for backend behavior. FastAPI routes
and Pydantic models implement its HTTP contract and generate OpenAPI. Keep them aligned with
the specification and regenerate the checked-in schema artifact after changing the API contract:

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

Spline and spiral primitives remain separate authoring objects. Connected spline runs use a
global C² minimum-jerk quintic planner, then adaptive cubic Bézier approximation controlled by
`CAMERA_PATH_COMPILE_TOLERANCE`. At a shared boundary with a spiral, the spline planner uses
the spiral's analytic tangent direction. Analytic spirals are not deformed at these junctions.
Bézier lengths and the adaptive arc-length table are computed from the resulting curves.

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
     "yaw_deg": 360,
     "pitch_deg": -10,
     "roll_deg": 5
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

## Email second factor (M3-10)

The editor signs in with an email address and password, then confirms a six-digit
code. `/api/v1/auth/login` returns a challenge, **not a token**. Only
`/api/v1/auth/verify` issues a session; `/api/v1/auth/resend` replaces its code.
Codes expire after five minutes, allow five failed checks, and can be resent after
60 seconds. Resends keep the failed-attempt count. Challenges and rate budgets are
persisted in SQLite and survive restarts; successful consumption and session
creation use one serialized database transaction across processes. This repository
implementation currently targets SQLite (including its UPSERT and write lock).

Limits: 10 password attempts/minute, 30 code checks/minute, five email sends/minute
and 20 sends/hour for the single editor. Minute/hour limits use fixed time windows.
Source budgets use the immediate connection peer, never arbitrary forwarded
headers. Production sets `FORWARDED_ALLOW_IPS=""` for Uvicorn; local launches must
use `--no-proxy-headers`. Next.js/Nginx clients share the proxy's source budget;
the persisted single-editor account budget still applies to every request.
Delivery failures do not issue a token or enable a challenge. Codes, passwords and
JWTs are never logged. Delivery uses a stored editor address, not a request-supplied
recipient. Email addresses are trimmed/lowercased and checked with a simple regex;
this is not a full RFC validator or a claim of inbox ownership before confirmation.

### Local verification before any CDK deployment

Use Mailpit as a local inbox. This exercises the full email-code flow without
creating AWS resources or sending to a real mailbox:

```bash
docker run --rm --name camera-path-mailpit \
  -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit
```

In a separate terminal, from `backend/`, add these settings to `.env` (keep your
existing JWT secret, or generate a new random secret of at least 32 bytes):

```dotenv
CAMERA_PATH_ENVIRONMENT=development
CAMERA_PATH_AUTH_SECOND_FACTOR=email
CAMERA_PATH_AUTH_EMAIL_DELIVERY=smtp
CAMERA_PATH_AUTH_SMTP_HOST=127.0.0.1
CAMERA_PATH_AUTH_SMTP_PORT=1025
CAMERA_PATH_AUTH_EMAIL_FROM=noreply@camerapath.dev
CAMERA_PATH_AWS_LIBRARY_STORAGE=local
CAMERA_PATH_DATABASE_URL=sqlite+aiosqlite:///./camera_path_2fa.sqlite3
CAMERA_PATH_JWT_SECRET=<your-random-secret-at-least-32-bytes>
```

Use a fresh trial database to keep your normal local projects separate. To use an
existing database instead, back it up and keep its configured URL. The new migration
revokes existing editor sessions, but preserves the editor record and project data.
A legacy non-email login will no longer work; explicitly replace it with your email:

```bash
uv sync --frozen
uv run alembic upgrade head
uv run editor-create you@example.com
uv run uvicorn camera_path.api:app --host 127.0.0.1 --port 8000 --no-proxy-headers
```

The CLI asks for the password interactively (minimum 12 characters). It revokes
existing sessions and unfinished sign-ins when replacing credentials. No placeholder
email is assigned during migration.

Run the frontend with `CAMERA_PATH_BACKEND_URL=http://127.0.0.1:8000` and `npm run dev`.
Open its Profile dialog, enter email/password, then read the code at
`http://127.0.0.1:8025`. Before confirming, editing must remain unavailable. Verify a
wrong code, a correct code, sign out, and inability to reuse the previous code.
For a new challenge, test resend after 60 seconds (the previous code stops working),
and expiry after five minutes. Mailpit is a development inbox; it does not demonstrate
AWS IAM, DNS verification, production delivery or inbox spam placement.

For ordinary development without a code, explicitly set
`CAMERA_PATH_AUTH_SECOND_FACTOR=off` with `CAMERA_PATH_ENVIRONMENT=development`.
Email/password remain required; SMTP and SES are not called. Off-mode tokens are
rejected when the backend runs with the email second factor. Production requires
`email` and `ses`; using `off` or the SMTP sink in production fails configuration
validation. Switching storage or browser hostnames does not select these modes.

### Optional real SES test from a local backend

If a verified SES sender already exists, no app-stack deployment is needed to test
real delivery: install `uv sync --frozen --extra aws`, select
`CAMERA_PATH_AUTH_EMAIL_DELIVERY=ses`, set `CAMERA_PATH_AUTH_EMAIL_FROM` to that
verified sender, and set `CAMERA_PATH_AWS_REGION` plus your existing AWS profile/SSO
credentials. Its IAM role must allow `ses:SendEmail` for the sender identity.
In sandbox, verify the editor's recipient email in that **same region** first.
If no identity is verified yet, local SMTP checks can proceed immediately; real
SES requires creating/verifying the identity and DNS separately or with CDK.
See `infra/README.md` for the post-review deployment and delivery checks.

## Application composition

`api.create_app` builds the common application from `AppDependencies`. Its
`@with_infrastructure` decorator in `composition.py` selects and injects local/AWS storage,
queue/source adapters and SMTP/SES delivery, then adds the routes supplied by those adapters.
Storage overrides control the available content routes; queue selection is independent.
The core factory and auth service do not select or import dev/AWS providers. Repository and
consumer ownership are managed through the ordinary application lifespan.

## Autonomous API integration tests

The standalone [HTTP contract suite](../integration/README.md) starts a disposable backend,
SQLite database, SMTP inbox and OpenAI-compatible HTTP fixture. It exercises the real
email-code login flow without an external email account, Docker or provider credentials.
See that guide for setup, API coverage, the optional real-time expiry test and CI.

## Queued job completion and multiple representations

Library items can contain multiple SOG/PLY representations with one primary file. External
producers complete a previously reserved job with a version-2 JSON message containing all result
assets. The monolith verifies every file, registers all assets and completes the job atomically.
The first successful completion wins, including after assets are deleted. The development adapter accepts authenticated JSON over HTTP; AWS
uses SQS. Files already inside library storage are adopted; external files are copied under UUIDs.
Read a job and its ordered results through `/api/v1/jobs/{job_id}`; job reservation does not start
a generator. Manual uploads remain independent, and project clouds use the primary representation.

See [the local verification and AWS configuration guide](docs/library-import.md). Run
`uv run alembic upgrade head` before starting against an existing database. Queue consumption is
disabled by default; enable `CAMERA_PATH_MESSAGE_QUEUE=dev` for local verification. AWS resource
setup and live verification are separate manual work.
