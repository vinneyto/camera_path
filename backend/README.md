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
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn camera_path.api:app --reload --no-proxy-headers
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

The library stores file metadata in the database and PLY, SOG or original image files in
`~/.camera-path/library` by default. Set `CAMERA_PATH_LIBRARY_DIRECTORY` to choose another
directory. Keep this directory persistent across backend restarts. The local storage adapter
provides development upload and download routes. Storage access is behind `LibraryStorage`,
so API and library service code do not depend on
the storage implementation.

To upload a file, call `POST /api/v1/library/uploads` with its `name`, `size_bytes` and `format`
(`ply` by default; `sog`, `png`, `jpg`, `jpeg` and `webp` are also supported). PUT the bytes to the returned
`upload_url`, then call `POST /api/v1/library/{id}/complete`. The final step checks the uploaded
size and format signature before the asset appears in `GET /api/v1/library` with a
`download_url`. Scene objects reference library assets from individual projects.
Preparing, uploading, confirming and deleting assets require an editor JWT. Downloading
ready files is public.

`DELETE /api/v1/library/{id}` removes the asset, its stored files and every scene object
that references it in every project. Remaining clouds retain their order with consecutive
positions, and each affected project's revision advances once. A storage deletion error
rolls back database changes so the request can be retried; missing file content is tolerated.
An unknown or already deleted asset returns 404.

`POST /api/v1/library/bulk-delete` accepts `{"asset_ids": ["id-1", "id-2"]}` and deletes
the entire selection in one request. All IDs are validated before files are touched. Each
affected project advances its revision once for the whole batch. `LibraryStorage.stage_delete`
keeps recoverable content until SQL commit; the local adapter moves files to a temporary
directory on the same filesystem and restores them on staging or transaction failures.
The frontend uses checkboxes and Actions → Delete selected with a React confirmation dialog.

### S3 library with a local backend (M3-1)

Install the AWS extra with `uv sync --extra aws`. Set these values in `backend/.env`, using the
`LibraryBucket` output from the [CDK stack](../infra/README.md) and its region.

```dotenv
CAMERA_PATH_AWS_LIBRARY_STORAGE=s3
CAMERA_PATH_AWS_S3_BUCKET=<LibraryBucket output>
CAMERA_PATH_AWS_S3_PREFIX=library/
CAMERA_PATH_AWS_REGION=us-east-1
```

The existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env` are read as secrets and
passed to Boto3; temporary credentials may also set `AWS_SESSION_TOKEN`. Alternatively set
`CAMERA_PATH_AWS_PROFILE` to a configured local profile and omit explicit keys. With neither supplied,
Boto3 uses its standard credential chain, including an EC2 IAM role. Standard `AWS_REGION`, `AWS_DEFAULT_REGION` and `AWS_PROFILE` remain supported as fallbacks;
project-prefixed values take priority. No AWS credentials reach
the browser. Keep `.env` untracked.

Run `uv run --extra aws alembic upgrade head`, then
`uv run --extra aws uvicorn camera_path.api:app --reload --no-proxy-headers`. Start the frontend with its
server-side `CAMERA_PATH_BACKEND_URL=http://127.0.0.1:8000`. S3 mode does not mount the local
file-content routes. Set `CAMERA_PATH_AWS_LIBRARY_STORAGE=local` to use filesystem storage again.
Use a separate `CAMERA_PATH_DATABASE_URL` for the S3 trial: switching adapters does not migrate
existing local files, and the database stores keys, not the storage backend or temporary URLs.

The browser PUTs bytes directly to a SigV4 URL for `library/_uploads/<id>.<format>`. Completion
checks the actual size and file signature using HeadObject and a range read, then copies the
staged object with the inspected ETag to `library/<id>.<format>`. The staging object is removed.
An old upload URL cannot overwrite the confirmed file. Completion is idempotent. If SQL fails
after the copy, the next attempt can recover the promoted object. Download URLs use the permanent key
and an attachment filename, including for guest viewing and project-cloud instances.
`CAMERA_PATH_AWS_S3_URL_TTL_SECONDS` defaults to 300 (60–3600). Refresh library/project metadata to
obtain fresh URLs after expiration; temporary AWS credentials may expire sooner.

See the [infrastructure guide](../infra/README.md) for the bucket's CORS rules and IAM
permissions for local development.

Deletion copies objects into `library/_delete/<operation-id>/` before removing live keys.
Staging or SQL failures restore them; backups are removed after commit. If restoration fails,
backups are retained for recovery. Cleanup failure after commit is logged without reporting a
failed deletion. A process crash can leave staging/backup objects: retain `_delete/` for manual
recovery and remove abandoned `_uploads/` only after their signed URLs expire. Replaying an
unexpired upload URL may recreate an unreferenced staging object.

Local smoke check: sign in, upload a PLY or SOG, view it in a project, download as a guest, restart the
backend and reopen it, then delete as an editor (including bulk deletion). Verify that guest
upload/completion/deletion is rejected. See [Test](#test) for the full backend suite.

### User profile settings

`GET /api/v1/profile/settings` returns the shared guest viewer profile. `webgpu_tile_renderer`
defaults to false (Spark/WebGL), `show_grid` defaults to true and `gaussian_dpr` defaults to
`"1x"` and also accepts `"system"`.
Anonymous reads never create or update profile rows. `PATCH` requires an editor JWT and saves
only supplied fields; it publishes the confirmed values as the guest fallback. No project ETag
is required. `CAMERA_PATH_DEV_USER_ID` (default `dev-user`) retains the existing M2 profile key;
it does not identify the authenticated editor or scope projects/chat/library to an owner.
Viewer preferences are always saved in browser localStorage and take priority over backend values.
Guests can edit them locally; editor changes also publish the supplied fields to this backend profile.
Login, logout and session expiry preserve local preferences.

### Editor authentication

Reads of projects, resources, library files, chat history and jobs are public. Every ordinary
write route, including local library uploads, job creation and both agent endpoints, uses the common
`@authenticated` decorator below `@router.post/patch/put/delete(...)`. Anonymous or invalid JWT
writes return
401 before revision checks or side effects. `AuthenticatedRoute` adds the standard FastAPI dependency
when registering marked endpoints; the decorator leaves endpoint signatures unchanged. Data remains
shared between guest and editor. Job-completion producers publish to the message broker.

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

The command asks for a password twice (6–1024 characters, with any character combination),
stores a salted Argon2 hash and
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

### Scene objects

`scene_objects` stores project-owned library instances or client-rendered primitives. Each object has
`parent_id`, local `position: [x,y,z]`, normalized `quaternion: [x,y,z,w]`, positive
`scale: [x,y,z]`, `library_asset_id`, `library_asset_file_id`, `sort_order` and `visible`.
The client composes world matrices and inherited visibility from the hierarchy.

A primitive has a nullable TEXT `primitive` containing a validated JSON string, for example
`{"type":"sphere","color":"#60a5fa"}`. Supported types are `cube`, `sphere` and `cone`;
unknown fields and invalid RGB hex colors are rejected. Exactly one source is required:
`primitive`, or a library asset/file reference. Primitive instances have null library IDs,
format and download URL. No geometry or generated model file is stored on the server.
The client builds centered unit geometry (cube sides 1, sphere diameter 1, cone diameter/height 1
with its tip along +Y). Existing local TRS defines its placement and dimensions; omitted primitive
transforms are identity. The agent's `create_scene_primitive` tool uses this same creation path.

Use `GET/POST /api/v1/projects/{id}/scene-objects` and
`PATCH/DELETE /api/v1/projects/{id}/scene-objects/{object_id}`. Creation defaults to the
asset's primary file and converts omitted transforms from its library defaults;
an explicit position is already the canonical local position, with no extra offset.
PATCH can change local transforms, parent, visibility and global project sort order.
Omitting parent preserves it; `parent_id: null` detaches with the local transform retained.
Parents must belong to the same project and cannot create cycles. Delete a parent's
children or detach them before deleting it; otherwise deletion returns `409`.
The same restriction protects surviving children during single/bulk asset deletion.
Mutations use the project revision in `If-Match`. Reset/delete clears the whole graph.

Run `uv run alembic upgrade head` before starting against an existing database.
Migration `20261104_0016` preserves object IDs/order/visibility and rendered transforms,
converts Euler XYZ to quaternions, expands uniform scales and folds model offsets
into position. Existing objects become roots and reference their actual primary file.
The `/clouds` interface is replaced by `/scene-objects`; deploy backend and client together.
A populated graph requires a pre-migration backup for a lossless downgrade.

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

FastAPI routes and Pydantic models define the HTTP contract and generate OpenAPI.
Regenerate the checked-in schema artifact after changing the API contract:

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
| LiDAR settings | LiDAR settings |
| Scene objects | scene objects, project metadata |
| Chat message/history | chat messages |
| Agent command or project reset | all project resources |

## Test

Run the suite in a shell without exported `AWS_*` or `CAMERA_PATH_*` settings. Tests
that load their own `.env` files depend on those values taking effect.

```bash
cd backend
uv sync --frozen --extra aws --extra rabbitmq
.venv/bin/python -m pytest
.venv/bin/ruff check .
```

## Populate development data

Create four demo projects for frontend development. The set includes a random spline, a random
spiral, a mixed spline → spiral → spline path and a sparse inertial path. Rerunning the command
with the same seed reuses the existing projects.

```bash
cd backend
uv run db-populate
```

Use another seed to create another set of demo projects.

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
deletes its camera keys. Mutations advance one shared project revision.

## Scene context and image attachments in chat

Chat message bodies accept optional `selected_object_id` and `attachment_ids` (up to eight).
The editor uses explicit `@label` / `@instance name` references in message text and does not send
the current selection as hidden context. The agent resolves names against the project's anchors
and scene instances. API clients may still supply a selection snapshot explicitly.
The backend saves a project-validated selection snapshot with the user message; changing selection
later does not retarget an earlier request. Original PNG/JPEG/WebP images (up to 20 MB each) are
staged with `POST /api/v1/projects/{id}/chat/attachments`, uploaded to the returned URL, then validated
with `POST /api/v1/projects/{id}/chat/attachments/{attachment_id}/complete`. Staging does not publish
the image in the library. The agent's `create_library_asset` tool publishes it explicitly.

The agent can start image generation, inspect jobs/library/scene objects, calculate fitted TRS,
place/update/delete scene instances, and replace an anchor atomically. Fit uses the stored model
bbox, library rotation defaults and anchor height; quaternions use XYZW. `replace_anchor_id` in the
agent's generation tool persists a replacement intent outside the worker input. Completion places
the generated model and removes the unchanged anchor in the same transaction as asset import.
Deleted/changed anchors or trajectory references skip placement and retain the generated asset.
Job details show the placement outcome. `GET /api/v1/projects/{id}/generation-jobs` supplies scene
refreshes after asynchronous completion. Failed generation preserves the anchor.

`tests/test_chat_scene_assets.py` and `integration/tests/test_chat_assets.py` exercise these paths
with a local Responses API fixture and worker result manifests. They require no real agent key.
Live natural-language behavior still requires `OPENAI_API_KEY`; no key is needed merely to upload
images or save selected-object context in chat.

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

Use Mailpit as a local inbox. This exercises the full email-code flow locally.
From the repository root, start the inbox with Compose.

```bash
docker compose -f backend/compose.yaml up -d --wait mailpit
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

The CLI asks for the password interactively (minimum 6 characters). It revokes
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
queue/source adapters and SMTP/SES delivery, then adds filesystem byte-serving routes if needed.
Storage overrides control the available content routes; queue selection is independent.
The core factory and auth service do not select or import dev/AWS providers. Repository and
consumer ownership are managed through the ordinary application lifespan.

## Autonomous API integration tests

The standalone [HTTP contract suite](../integration/README.md) starts a disposable backend,
SQLite database, SMTP inbox and OpenAI-compatible HTTP fixture. It exercises the real
email-code login flow without an external email account or provider credentials. Queue scenarios
require Docker and manage their own temporary RabbitMQ broker.
See that guide for setup, API coverage, the optional real-time expiry test and CI.

## Queued job completion and multiple representations

Library items can contain multiple SOG/PLY representations with one primary file. External
producers complete a previously reserved job with a version-2 JSON message containing all result
assets. The monolith verifies every file, registers all assets and completes the job atomically.
The first successful completion wins, including after assets are deleted. Development uses
RabbitMQ over AMQP; AWS uses SQS. The common consumer knows neither provider. Files already
inside library storage are adopted; external files are copied under UUIDs.
The Jobs page lists every job type with its saved `name`, lifecycle status, errors and surviving
library results. Creation accepts an optional top-level `name` (up to 200 characters);
blank/null selects an automatic name. Text jobs join the first five whitespace-separated prompt words with `_`.
Image jobs use the complete source filename, including its extension. The name remains after source
deletion. Original image assets retain the complete filename; image-generated 3DGS assets use
the filename stem, including when the job has a custom name. Text-generated assets use the job
name. Migrations update the old automatic job/result labels while preserving custom names;
legacy jobs without recoverable metadata keep a null name. The public API lists jobs at
`GET /api/v1/jobs`, returns details at
`GET /api/v1/jobs/{id}` and streams status through `GET /api/v1/jobs/{id}/events`.
Editors can reserve a draft through `POST /api/v1/jobs` with
`{"type":"generation","input":{"prompt":"A wooden chair"}}`. The generation form includes
`"start":true` so the backend persists the job as queued and dispatches it to Trellis.
The server validates input against its JSON Schema, rejects unknown types/fields and blank prompts,
and stores the exact validated JSON. Frontend presets are not stored on the backend.
Image jobs use `{"type":"generation","input":{"image_asset_id":"<image UUID>"},"start":true}`.
The referenced image must already be ready in the library. PNG/JPEG/WebP uploads are
limited to 20 MB, 40 megapixels and one frame, and fully decoded before publication.
Job details expose the original as `input_asset`, separately from generated `assets`.
Deleting an image used by any queued/running job returns `409 generation_input_in_use`
(including bulk deletion). After success/failure/cancellation, deletion is allowed;
`input_asset` becomes null while `input.image_asset_id` preserves history. Images cannot
be placed in scenes or receive 3D transform defaults.

For local RabbitMQ generation the backend copies the original into the worker output
directory, sends its absolute `image_path` and `image_sha256`, and validates the returned
manifest against those resolved parameters. This also works when the library uses S3.
The worker removes backgrounds for generation only. The configured default rotation
applies to generated PLY/SOG outputs from both text and image jobs.
Jobs have `draft`, `queued`, `running`, `succeeded`, `failed` or `cancelled`
status; terminal states have `completed_at`. Successful completion import updates the status
atomically with the results. Deleting assets does not change job history. Legacy jobs keep their
IDs/results with null type/input and unknown creation/start times; their completion timestamps
are preserved. Apply `alembic upgrade head` before running against an existing database.

See [the local verification and AWS configuration guide](docs/library-import.md). Run
`uv run alembic upgrade head` before starting against an existing database. Queue consumption is
disabled by default; install `uv sync --frozen --extra rabbitmq`, start `docker compose up -d --wait`
and enable `CAMERA_PATH_MESSAGE_QUEUE=rabbitmq` for local verification. Publish JSON using the
broker's management API or an AMQP client, without a backend debug API. Ordinary job creation
still requires the editor. AWS resource setup and live verification are separate manual work.

To enable generation from the Jobs form, start the [local Trellis worker](../generation/README.md)
and set these values in `backend/.env`.

```dotenv
CAMERA_PATH_MESSAGE_QUEUE=rabbitmq
CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY=~/.camera-path/generation
```

The directory must match `GENERATION_OUTPUT_DIR` in the worker's configuration. If you override
the queue names, set `CAMERA_PATH_GENERATION_REQUEST_QUEUE` and `CAMERA_PATH_GENERATION_RESULT_QUEUE`
to the same values used by the worker. The backend reads the result manifest and imports the files
as one library asset with a shared bounding box. The job details page refreshes through SSE.

Dev Setup writes an active `CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG=[180,0,0]` in
`backend/.env` when no value is configured, and preserves custom values. You can also set it manually
to correct upside-down Trellis output. The three values are Euler XYZ angles in degrees.
The backend saves them as library placement defaults on newly generated assets. The PLY
and its bounding box stay in the original asset coordinates. Set `[0,0,0]` explicitly
to keep zero rotation through Dev Setup.
