# Camera Path — Backend Specification

The primary document for implementing and changing the backend:
**`backend/SPECS.md → code → tests`**. It defines behavior, data and system boundaries.
A human edits the specification; on an explicit request, an agent brings the
implementation into line with the changed requirements.

Initial baseline: October 31, 2026, `main` at commit
[`32d1940`](https://github.com/vinneyto/camera_path/commit/32d194088acd79b8f03c8298d94baf85800a416b).
This is the document's starting point, not a requirement to retain that implementation
forever. Sections 1–13 describe the current Python backend. Section 14 records known
limitations; section 15 covers future changes outside the current `main` contract.

## Contents

- [1. Working with this specification](#1-working-with-this-specification)
- [2. Purpose and scope](#2-purpose-and-scope)
- [3. Entities and defaults](#3-entities-and-defaults)
- [4. HTTP, revisions and errors](#4-http-revisions-and-errors)
- [5. Projects and scene editing](#5-projects-and-scene-editing)
- [6. Timelines](#6-timelines)
- [7. Trajectory compilation](#7-trajectory-compilation)
- [8. Library and project clouds](#8-library-and-project-clouds)
- [9. Authentication and profile](#9-authentication-and-profile)
- [10. Chat and agent](#10-chat-and-agent)
- [11. Persistence, configuration and operations](#11-persistence-configuration-and-operations)
- [12. HTTP operation inventory](#12-http-operation-inventory)
- [13. Conformance checks](#13-conformance-checks)
- [14. Limitations and open questions](#14-limitations-and-open-questions)
- [15. Planned changes](#15-planned-changes)
- [16. Sources and implementation map](#16-sources-and-implementation-map)

## 1. Working with this specification

**SPEC-01. Authority.** Once accepted, this document defines expected backend
behavior. Code implements the requirements and tests verify them; any discrepancy
must be identified explicitly. An implementation bug must not automatically become
a requirement. OpenAPI is the precise machine-readable HTTP contract, generated from
the implementation. It must agree with this specification rather than act as an
independent source of product decisions. READMEs contain run instructions; Drive
tasks preserve history, plans and acceptance criteria for individual changes.

**SPEC-02. Changes.** The user edits a requirement and asks for its implementation.
The agent reads the current specification, identifies affected operations, data,
migrations and clients, then changes code and the necessary checks. If the
implementation request itself clarifies a requirement, update the specification
in the same PR. Explain any contradiction before choosing incompatible behavior.

**SPEC-03. Task scope.** Editing this document alone does not trigger implementation.
A task covers the requested requirements, not the entire backlog in section 15.
This document is not an automatically executable code generator.

**SPEC-04. Stable references.** Keep identifiers such as `API-01` and `LIB-02` when
moving text; do not reuse retired numbers. Give each new requirement a new number.
A PR identifies affected requirements, completed checks and remaining discrepancies.
A material behavior change includes a specification update, OpenAPI/client changes
when HTTP changes, and a migration when persisted data changes.

## 2. Purpose and scope

**SCOPE-01.** The backend serves a 3D camera-path editor. It stores projects and scene
data, semantic paths, motion and camera controls, a shared 3DGS library and its
instances in projects. It compiles paths into playback data and provides chat with
an agent that can edit an allowed subset of project resources.

**SCOPE-02.** Authoring data and compiled trajectories are separate. Compilation is
a derived read that does not modify the project. Splat rendering, picking, camera
evaluation per frame, autofocus and LiDAR intersections run on the client. Ordinary
file uploads do not make the backend decode or train 3DGS models.

**SCOPE-03.** Data is shared and published: guests read it; one authenticated editor
can change it. There are currently no private user projects, public registration,
multiple-editor roles or per-user libraries. Core geometry and REST operations work
without OpenAI credentials.

## 3. Entities and defaults

**DATA-01.** IDs are strings. New projects, scene entities, keyframes, assets and
cloud instances receive server-generated UUIDs. Authentication challenges use a
separate opaque ID. Scene references resolve within their project. Segment, message
and cloud ordering is preserved. A JSON `Vec3` is `[x, y, z]`. Coordinates and lengths
use scene units; they represent meters and meters per second when the scene scale
is metric.

| Entity | Data and rules |
| --- | --- |
| ProjectMetadata | `id`, `name`, `revision`, `anchor_count`, `segment_count`; no nested project |
| Project | Internal aggregate: anchors, scene points, ordered segments, camera track, motion profile, chat history; clouds are read separately |
| Anchor | `id`, `label` (1–64 characters), `surface_position`, nonzero `surface_normal`, `lift`, `lift_axis` |
| ScenePoint | `id`, `label` (1–64 characters), `position`; independent aim/DOF target |
| SplineSegment | `id`, `kind="spline"`, ordered `anchor_ids` (at least 2), `tension` in `[0,1]` |
| SpiralSegment | `id`, `kind="spiral"`, start/center/end anchor IDs, `turns` in `(0,100]`, direction, radial/axial law |
| SpeedKeyframe | `id`, `path_position`, positive `speed`, `interpolation_to_next` |
| CameraKeyframe | `id`, `path_position`, `aim`, `interpolation_to_next` |
| CameraOrientationKeyframe | `id`, `path_position`, `orientation`, `interpolation_to_next` |
| DepthOfFieldKeyframe | `id`, `path_position`, `focus`, `focus_range_scale > 0`, `bokeh_scale >= 0` |
| LidarKeyframe | One optional presence keyframe at `path_position=0`, with static angular settings |
| ChatHistoryMessage | `id`, `role=user\|assistant`, `content`; messages are ordered |
| LibraryAsset | Server `id`, `name`, `format=ply\|sog`, `size_bytes`, `status=pending\|ready`, `created_at`, default transform, computed `download_url` |
| ProjectCloud | Own `id`, `project_id`, `library_asset_id`, order, visibility, translation/rotation/scale/offset; name, format and URL resolve from the asset |

**DATA-02.** A new project has name `Untitled camera path` (1–128 characters allowed),
revision `0` and empty collections. Initial values:

| Setting | Value |
| --- | --- |
| Anchor normal / lift / lift_axis | `[0,1,0]` / `0` / `world_up` |
| Spline tension | `0` |
| Spiral turns / direction / radial_law / axial_law | `1` / `ccw` / `smoothstep` / `smoothstep` |
| Motion default_speed | `1` |
| Camera default_aim / world_up | `{kind:"follow_path", direction:"forward"}` / `[0,1,0]` |
| Camera default_orientation | `{yaw_deg:0, pitch_deg:0, roll_deg:0}` |
| Interpolation for speed/aim/orientation keys | `smoothstep` |
| DOF key focus / focus_range_scale / bokeh_scale | `{kind:"center_weighted_9"}` / `0.25` / `6` |
| LiDAR | Absent; when created, `60°`, `512 × 32` |
| Library default_rotation_deg / default_scale / default_offset | `[0,0,0]` / `1` / `[0,0,0]` |
| Cloud translation / visible | `[0,0,0]` / `true` |

**DATA-03.** Every keyframe's `path_position` is in `[0,1]` and denotes normalized
arc length over the **entire** path: traveled distance / total length. It is neither
time nor a local Bézier parameter. Positions must be unique within each speed, aim,
orientation or DOF timeline; equal positions across different timelines are allowed.
An empty aim timeline is valid: a keyframe at position `0` is not required.

## 4. HTTP, revisions and errors

**API-01.** The canonical JSON API is under `/api/v1`. Reads return metadata, one
resource or a list, without the full `Project`. The derived `CompiledTrajectory`
is the exception in data volume. `ChatResponse` contains `{answer, compiled}`.
Lists currently return all items without pagination. Section 12 lists every operation.

**API-02.** All project resources share one project revision. Reads of one project
or its resources and ordinary mutation responses include `ETag: "<revision>"`.
Project creation does not require `If-Match`. Canonical `POST/PATCH/DELETE` requests
addressing an existing `{project_id}` require the editor to send the current
`If-Match`. The current parser accepts a quoted integer and the weak form `W/"4"`;
ETag lists, `*` and unquoted integers are unsupported. This is revision comparison,
not an HTTP cache API.

**API-03.** A missing `If-Match` returns `428`; a malformed or stale value returns
`409`. Concurrent updates must not be lost: the resource change and atomic revision
increment occur in one transaction that checks the expected revision. A failed
transaction changes neither data nor revision. An ordinary persisted edit increments
the revision by one; explicitly idempotent operations may keep it unchanged. Deleting
the project itself returns its last revision, since there is no surviving project row.

**API-04.** Chat has two persistence boundaries: the user message and the completed
agent turn (section 10). For SSE, the final revision is in
`result.compiled.revision`, not a header sent before completion. Library and profile
mutations do not require a project ETag; asset deletion increments the revisions of
affected projects itself.

**API-05.** Canonical errors have `{code, detail, field_errors?}`. Validation errors
include `location`, `message` and `type` in `field_errors`. Main mappings:

| HTTP | code / condition |
| --- | --- |
| 401 | `http_error`: missing, invalid or revoked session; `WWW-Authenticate: Bearer` when authentication is required |
| 404 | `project_not_found` for a project; `not_found` for other missing resources |
| 409 | `revision_conflict`, `chat_message_conflict`, `reference_conflict` |
| 413 | `http_error`: local upload exceeds its declared size |
| 422 | `validation_error`, `invalid_geometry`; some explicit resource checks return `http_error` |
| 428 | `if_match_required` |
| 429 | `http_error`: authentication rate limit / resend cooldown, with `Retry-After` |
| 502 | `storage_unavailable` for storage adapter errors; `upstream_error` for HTTP-level upstream failures |
| 503 | `agent_unavailable` for HTTP 503; also used when authentication configuration or email delivery is unavailable |

Some current error codes have broader uses than their historical names suggest:
`agent_unavailable`, for example, does not prove that an error concerns the agent.
Changing this mapping is a separate contract change. Failures after SSE begins use
an `error` event instead of a new HTTP status.

**API-06.** CORS allows configured frontend origins, credentials and reading ETag.
A client receiving project resources at different revisions refetches responses
older than the highest observed revision. After a mutation, refetch the changed
resource and dependent compiled trajectory; agent/reset invalidate all project
resources. An older response revision must not roll back newer client state.

**API-07.** Unversioned project routes temporarily support aggregate responses for
compatibility and do not require `If-Match`; writes still require the editor. They
are hidden from OpenAPI. Apply business-rule changes consistently to both paths.
Removing the legacy API requires an agreed client transition. Undo/redo are not mounted.

## 5. Projects and scene editing

**PROJECT-01.** Creation returns empty-project metadata. The list returns metadata
with current anchor/segment counts. Renaming preserves the ID and resources.
Deleting a project deletes its scene resources, timelines, chat and cloud instances;
shared library files remain.

**PROJECT-02.** Reset preserves the ID and name, clears anchors, scene points,
segments, timelines, chat and cloud instances, restores initial settings and
increments the revision. It does not delete library assets or profile settings.

**SCENE-01.** An anchor's effective position is
`surface_position + lift × axis`. For `world_up`, the axis is `[0,1,0]`; for
`surface_normal`, use the normalized normal. Negative lift is allowed. Updating an
anchor preserves its ID and references. An anchor used by a spline/spiral cannot
be deleted: return `409` without partially changing the scene.

**SCENE-02.** A ScenePoint can be referenced by the default aim, aim keyframes and
DOF. Deleting a referenced point without cascade returns `409`. `?cascade=true`
atomically deletes dependent aim/DOF keyframes and the point. If the **default aim**
references the point, deletion is blocked even with cascade: change the default aim
first. References to a point in another project are invalid.

**SCENE-03.** Segments are appended to the ordered path. A spline references an
anchor sequence; a spiral references start/center/end anchors. References are checked
before persistence. Deleting a segment preserves anchors and other settings.
There are currently no segment update/reorder operations.

**SCENE-04.** Clear trajectory removes segments and all motion/camera timelines,
including LiDAR, and restores baseline defaults. Anchors, scene points, chat, cloud
instances, project name and ID remain. Clear chat deletes only the conversation.
Deleting an individual timeline, described below, is different from clearing the
trajectory or resetting the project.

## 6. Timelines

**TIME-01. Speed.** `default_speed > 0`. Each speed key stores a positive speed and
a transition to the next key: `hold`, `linear` or `smoothstep`. `hold` keeps the left
value until the next key; `linear` interpolates linearly; `smoothstep` uses
`u²(3−2u)`. If the path endpoints are uncovered, the compiler inserts default speed
at `0`/`1`. Deleting the speed timeline clears its keys and sets `default_speed=1`,
preserving other resources.

**TIME-02. Aim.** `follow_path` uses the forward/backward tangent; `look_at_point`
references a ScenePoint. The track has a default aim, a nonzero world_up and optional
keyframes. The compiler resolves ScenePoint references to world-space positions and
sorts keys. Runtime computes directions, interpolates them, normalizes the result
and builds a frame using world_up. Deleting the aim timeline clears keys and restores
forward follow_path and `[0,1,0]`.

**TIME-03. Orientation.** Finite `yaw_deg/pitch_deg/roll_deg` values use degrees,
without range clamping or wrapping: `0 → 360` means a full turn. Default orientation
and keys are independent of aim. Runtime applies offsets to the aim frame in order:
yaw around local up, pitch around local right, roll around the view axis. Transitions
interpolate scalar angles. Deleting the timeline clears keys and zeroes default
orientation. `PATCH /camera/orientation` accepts the three angles directly, without
a keyframe wrapper.

**TIME-04. DOF.** Focus is `center_weighted_9` or `scene_point` with an existing ID.
The compiler resolves scene-point focus to a position. Creating the timeline without
a body adds a default key at position `0` only if no keys exist. Repeating creation
preserves existing keys and revision. Deleting the timeline clears all DOF keys;
deleting the last key leaves an empty timeline. DOF keys have no
`interpolation_to_next` field.

**TIME-05. LiDAR.** An absent keyframe disables the sensor. `PATCH /camera/lidar`
creates/updates a singleton at position `0`; `{}` creates defaults or preserves
existing parameters. The existing singleton's ID is preserved. Parameters are static:

| Field | Constraint | Default |
| --- | --- | --- |
| `vertical_fov_deg` | Finite number, `0 < fov < 180` | `60` |
| `horizontal_resolution` | Strict integer, `1..4096` | `512` |
| `vertical_resolution` | Strict integer, `1..256` | `32` |

Unknown fields and animated positions are rejected. Horizontal span is 360°;
vertical range is `−fov/2 .. +fov/2`. Resolutions specify angular sample counts.
Deletion removes the singleton. Settings are read through the separate LiDAR
resource and are not part of the current `CompiledCameraTrack`. The renderer
computes intersections.

## 7. Trajectory compilation

**GEOM-01.** The compiler validates references, unique key positions and nonzero
world_up. Adjacent segments with different boundary anchor IDs produce a
`not C0-connected` warning rather than prohibiting persistence. Incompatible analytic
tangents of adjacent spirals also produce a warning. `tension` is retained for
compatibility but does not affect the minimum-jerk spline; a nonzero value produces
a warning. A starting aim key is not required.

**GEOM-02. Spline.** Adjacent splines sharing a boundary anchor form a run. Lifted
anchor positions define a global C² minimum-jerk quintic path using centripetal knot
spacing, jointly solved velocities/accelerations and natural endpoint conditions.
At a boundary with an analytic spiral, its tangent direction constrains the spline.
The quintic is adaptively approximated by cubic Bézier curves using the configured
tolerance. This is not Catmull–Rom. Consecutive coincident anchor positions cannot
be compiled.

**GEOM-03. Spiral.** The axis is world Y through the center anchor. Start/end define
radii, heights and final phase; choose the phase nearest the requested turns without
reversing direction. Start cannot lie on the axis. If end lies on the axis, retain
the requested turn count. Radius/height follow `linear`/`smoothstep` laws. Split the
angular interval into pieces of at most 45° and build cubic controls from endpoint
positions/derivatives. Endpoints match the lifted start/end; the analytic spiral is
not deformed at a spline junction.

**GEOM-04. Length and time.** Recursively compare each cubic's chord and control
polygon lengths. Subdivision yields its length and an adaptive
`(segment_index,t,distance)` table. Distances accumulate over the entire path;
total length is the sum of curve lengths. Duration is
`total_length × integral(1 / speed(path_position), 0..1)`, using 16-point
Gauss–Legendre quadrature on control intervals. An empty path has empty curves/table
and zero length/duration. At constant speed, `duration=length/speed`.

**GEOM-05. Output.** `CompiledTrajectory` contains `project_id`, `revision`,
`position_segments` with `source_segment_id`, control points and length,
`arc_length_table`, `total_length`, `duration_seconds`, sorted motion/camera/DOF
keys, resolved point references and `warnings`. The backend does not return frames
or quaternions per frame. Identical inputs produce repeatable compilation within
numerical precision. Compilation creates no new revision and currently runs again
on every read.

**GEOM-06. Validation boundaries.** Ordinary resource mutations validate domain
references/invariants; full numerical compilation is not required for every edit.
Currently, adding a spiral and completing an agent turn compile the draft before
commit. A spline can be saved before a numerical error is discovered by a compiled
read. Requiring compilation for all mutations needs a separate decision.

## 8. Library and project clouds

**LIB-01. Upload.** Lifecycle: create upload → PUT bytes to `upload_url` → complete
→ ready. Creation accepts `name` (1–200 characters, nonblank after trimming),
`size_bytes` and `format` (`ply` by default; `sog` is also supported). It creates a
pending asset with a server-generated `<id>.<format>` key. The current declared-size
limit is `2,147,483,648` bytes (2 GiB); the size must be positive. Pending assets
are excluded from public ready-asset list/get operations and cannot become project
instances.

**LIB-02. Completion.** Complete checks file existence, exact size and container
signature: the first four bytes of PLY must be `ply\n` or `ply\r`; SOG must start
with `PK\x03\x04`. This validates the container signature, not the full decoded
format. An invalid file remains pending and returns `422`. Successful completion
publishes a ready asset; repeating complete on a ready asset returns the same resource.

**LIB-03. Storage.** Domain operations use a common LibraryStorage contract:
upload/download URLs, inspection/finalization and staged deletion. The adapter
computes URLs on reads; the database stores object keys rather than temporary URLs.

- Local: an editor-only streaming PUT writes a temporary file. Exceeding the
  declared size returns `413`; an incomplete upload returns `422`. Temporary files
  are cleaned up; an atomic rename replaces the completed file. Public GET serves
  ready content only.
- S3: a private bucket with expiring presigned PUT/GET URLs (default TTL 300 seconds).
  PUT writes under `_uploads/`; complete checks size/signature and promotes the
  inspected object into the ready namespace using an ETag precondition. An old upload
  URL cannot overwrite a ready object. Retrying after promotion/SQL failure can
  recover completion.

**LIB-04. Deletion.** Single/bulk delete validate the full selection before making
changes; duplicate bulk IDs are deduplicated. They remove asset records, bytes and
all associated cloud instances. Each affected project's revision increments once
per batch; other project resources remain and cloud order is compacted. An unknown
selected ID returns `404` without partial deletion. Already-missing bytes do not
prevent record deletion. Storage staging encloses SQL commit: bytes are restored
on failure; temporary backups are cleaned up after commit. If restoration fails,
backups remain for recovery. This is not a distributed transaction guaranteed to
survive every possible crash.

**LIB-05. Defaults.** Assets store finite Euler XYZ `default_rotation_deg`, positive
`default_scale` and finite `default_offset`. PATCH requires rotation and scale;
omitting offset preserves its previous value. Changing defaults affects **new**
cloud instances only. The file and existing instances remain unchanged.

**CLOUD-01.** A ready asset can be attached multiple times to one or more projects.
Each operation creates a separate instance ID, copies current asset defaults,
accepts finite translation, sets visible=true and appends to the ordered list.
It does not copy the file. Instance deletion is separate from asset deletion.
Project reset/delete removes instances while retaining the shared library.

**CLOUD-02.** Instance PATCH changes `position` and/or `visible`; an empty patch is
rejected. Position is an index in `0..count−1`; reordering preserves a unique,
contiguous order. Persisted rotation/scale/offset are returned but cannot be edited
through the current cloud PATCH. Applying transforms in the renderer is outside
the backend boundary; extending the transform API is planned work.

## 9. Authentication and profile

**AUTH-01.** Public GET operations read shared data; `GET /auth/session` requires
Bearer authentication. Business writes, local upload, profile update and logout
require a valid editor session. Login/verify/resend do not require a JWT. The single
editor is created/replaced using `editor-create` with an email and a 12–1024-character
password; there is no public registration. Passwords are stored as Argon2 hashes.
Replacing credentials revokes sessions and unfinished sign-ins.

**AUTH-02.** In normal mode, login checks email/password and returns
`{challenge_id, expires_in, resend_after}`. Verify then consumes the six-digit
email code and creates a session. A code expires after 300 seconds; a challenge
allows at most 5 verification attempts. Resend is available after 60 seconds and
replaces the code and expiry without resetting attempts. A successful code is
consumed once; concurrent verification cannot create two sessions. Delivery targets
the stored editor email. Failed delivery neither activates the challenge nor issues
a token. Passwords, codes and JWTs are excluded from logs.

**AUTH-03.** Fixed-window budgets are persisted across restarts: 10 password
attempts/minute, 30 code checks/minute, 5 sends/minute and 20 sends/hour. Both account
and immediate-peer source budgets are checked; arbitrary X-Forwarded-For values
are not trusted as client addresses. Throttling returns `429` with `Retry-After`.

**AUTH-04.** Verify returns `{access_token, token_type:"bearer", expires_in}`.
JWT uses HS256, issuer `camera-path`, audience `camera-path-api`, the editor subject,
credential version and session ID. Validation checks the signature, required claims,
expiry, active database session and email authentication mode. Default TTL is 28,800
seconds; the allowed range is 60–86,400. There is no refresh token. Logout revokes
the current session; replaying its token then fails. Signing requires a secret of
at least 32 bytes; without it, login/authenticated access are unavailable while
public reads continue to work.

**AUTH-05.** Explicit development `auth_second_factor=off` retains email/password
but makes login return a token directly without sending email. Email mode rejects
such tokens. Production requires the email second factor and SES; off/SMTP in
production fails configuration validation. The Next.js browser proxy stores JWTs
in HttpOnly SameSite=Strict cookies (Secure in production), validates Origin for
browser writes and adds Bearer authentication. Raw tokens are not part of browser
storage/UI. This is an integration contract with the frontend.

**PROFILE-01.** The shared profile is stored under the configured `dev_user_id`
(default `dev-user`), independently of projects and the JWT username. GET is public;
PATCH is editor-only. Defaults: `webgpu_tile_renderer=false` (Spark/WebGL),
`show_grid=true`, `gaussian_dpr="1x"`; DPR also accepts `system`. PATCH is partial,
booleans are strict, unknown fields are rejected and omitted fields are preserved.
Preferences survive restarts and project reset/delete without changing the project
revision.

## 10. Chat and agent

**CHAT-01.** A request is `{id, message}`, with a 1–10,000-character message. A UUID
is generated if ID is omitted. The user message is persisted **before** contacting
the model or checking its availability. Repeating an ID with the same role/content
creates neither another message nor another revision; a different content/role with
the same ID returns `409 chat_message_conflict`. This makes message persistence
idempotent, not the execution of an entire LLM turn.

**CHAT-02.** The agent sends persisted conversation history and system instructions
to the OpenAI Responses API. There are at most 12 rounds with
`parallel_tool_calls=false`; returned calls execute sequentially against a draft.
Each call runs on a draft copy and is validated. A failed call returns an error
to the model without leaving partial edits. Tool edits are not committed individually.
The final answer and all successful edits are compiled and saved in one project
revision with an optimistic revision check.

**CHAT-03.** Current tools:

| Area | Commands |
| --- | --- |
| Reading | `get_project_state` (anchors, scene_points, segments, motion_profile, camera_track) |
| Path | `create_spline`, `create_spiral`, `delete_segment` |
| Scene points | `create_scene_point`, `update_scene_point`, `delete_scene_point` |
| Speed | `set_default_speed`, `create_speed_keyframe`, `update_speed_keyframe`, `delete_speed_keyframe` |
| Aim | `create_camera_keyframe`, `update_camera_keyframe`, `delete_camera_keyframe` |
| Orientation | `create_camera_orientation_keyframe`, `update_camera_orientation_keyframe`, `delete_camera_orientation_keyframe` |
| DOF | `create_depth_of_field_keyframe`, `update_depth_of_field_keyframe`, `delete_depth_of_field_keyframe` |
| LiDAR | `set_lidar_timeline`, `delete_lidar_timeline` |

Anchor creation/movement, library/cloud operations, project rename/reset/delete,
undo/redo and default aim/orientation changes are not currently available as tools.
The model selects a command; the backend executes it deterministically and validates
domain rules.

**CHAT-04.** A missing API key returns `503`; provider failure in ordinary chat
returns `502`. The user message remains persisted after a failed turn. If final
validation, compilation or revision checking fails, the assistant message and tool
edits are not committed. No database transaction spans the model's entire operation.
A successful canonical chat response is `{answer, compiled}`, with an ETag matching
the final revision.

**CHAT-05. SSE.** Consume the POST stream with streaming fetch rather than ordinary
EventSource. Content-Type is `text/event-stream`, buffering is disabled and
Cache-Control is no-cache. Each event has `event: <name>`, JSON `data: ...` and a
blank-line separator:

| event | data | Meaning |
| --- | --- | --- |
| `delta` | `{text}` | Provisional text; does not confirm persistence |
| `result` | `{answer, compiled}` | Turn committed; read the revision from compiled and refresh resources |
| `error` | `{code:"stream_error", detail}` | Failure after response start; this event does not confirm a successful commit |

Tool outputs return to the model rather than appearing as separate public SSE
events. Saving the user message before stream start is idempotent when called again
internally. The current chat stream has no event IDs/replay and is separate from
the planned library/generation event stream. A client disconnect alone guarantees
neither rollback of persisted data nor cancellation of the provider request.

## 11. Persistence, configuration and operations

**STORE-01.** The main store is SQLite through async SQLAlchemy; schema migrations
use Alembic. The current migration head is `20261026_0014`. Current state is
normalized into typed columns; numeric vectors are not opaque JSON blobs. Foreign
keys are enabled. A Project aggregate is assembled for compatibility; full-snapshot
history with undo/redo is no longer the active persistence model.

| Group | Tables |
| --- | --- |
| Project / scene | `projects`, `anchors`, `scene_points`, `trajectory_segments`, `segment_anchors` |
| Controls | `motion_profiles`, `speed_keyframes`, `camera_tracks`, `aim_keyframes`, `orientation_keyframes`, `depth_of_field_keyframes`, `lidar_keyframes` |
| Library | `library_assets`, `project_clouds` |
| Chat / profile | `chat_messages`, `user_settings` |
| Auth | `editors`, `editor_sessions`, `auth_challenges`, `auth_rate_limits` |

**STORE-02.** An operation changes its target resource, preserves unrelated rows
and references, retains ordering and checks the revision in the same transaction.
Reads do not create missing domain records. Migrations preserve IDs, references,
files and existing preferences. A default change must not overwrite an explicitly
persisted user choice. Startup `create_all` for missing tables does not replace
upgrading an existing schema.

**OPS-01.** Main settings come from environment variables/a local `.env`; secrets
are not committed.

| Setting | Purpose / default |
| --- | --- |
| `CAMERA_PATH_DATABASE_URL` | `sqlite+aiosqlite` database; defaults to `~/.camera-path/camera_path.sqlite3` |
| `CAMERA_PATH_LIBRARY_DIRECTORY` | Local bytes; defaults to `~/.camera-path/library` |
| `CAMERA_PATH_AWS_LIBRARY_STORAGE` | `local` / `s3`, default `local` |
| `CAMERA_PATH_AWS_S3_BUCKET`, `CAMERA_PATH_AWS_S3_PREFIX` | Bucket required for S3; default prefix `library/` |
| `CAMERA_PATH_AWS_S3_URL_TTL_SECONDS` | 300; allowed range 60–3600 |
| `CAMERA_PATH_COMPILE_TOLERANCE` | Positive value, default `0.001` |
| `CAMERA_PATH_CORS_ORIGINS` | Comma-separated origins; defaults to localhost/127.0.0.1:3000 |
| `CAMERA_PATH_JWT_SECRET`, `CAMERA_PATH_JWT_TTL_SECONDS` | Signing secret / session lifetime |
| `CAMERA_PATH_ENVIRONMENT` | `development` / `production` |
| `CAMERA_PATH_AUTH_SECOND_FACTOR`, `CAMERA_PATH_AUTH_EMAIL_DELIVERY` | Defaults `email` / `smtp`; production requires `email` / `ses` |
| `CAMERA_PATH_AUTH_EMAIL_FROM`, `CAMERA_PATH_AUTH_SMTP_HOST`, `CAMERA_PATH_AUTH_SMTP_PORT` | Sender / loopback SMTP host / default port 1025 |
| `OPENAI_API_KEY`, `CAMERA_PATH_OPENAI_MODEL` | Optional chat key / default model `gpt-5.6-luna` |
| `CAMERA_PATH_DEV_USER_ID` | Shared profile key, default `dev-user` |

The AWS adapter uses the configured region/profile or standard credentials chain;
specific credentials are not part of the specification. S3/SMTP/SES are selected
in the composition root. Project operations do not depend on the bytes/email
delivery mechanism.

**OPS-02.** `/health` returns `{status:"ok"}` and is a liveness endpoint, not a
complete database/S3/SES/OpenAI check. `/docs` serves Scalar; OpenAPI is available at
`/api/v1/openapi.json`. Current infrastructure in `infra/` uses EC2 with Nginx/HTTPS
and loopback Uvicorn, a separate persistent EBS volume for SQLite, private S3 library
and backup buckets, Secrets Manager and SSM. Exact topology, configuration and the
release runbook are in [infra/README.md](../infra/README.md).

**OPS-03.** A code release selects an exact published commit and preserves the
stable AMI and existing data resources. Release stops the writer, creates a verified
SQLite backup, applies migrations and checks health. Failure recovery restores the
previous database/version according to the runbook. Ordinary code or backend-language
changes must not require replacing EC2/EBS/S3. This document and its PR do not perform
a production deployment.

## 12. HTTP operation inventory

**HTTP-01.** The table lists all 70 operations in the current checked-in OpenAPI.
Every path includes `/api/v1`. Request/response DTO names match schemas in
[openapi.json](openapi.json). Check fields, required/nullability and exact JSON
shapes against that machine-readable schema together with the rules above. `—`
means no body. A successful `204` has no JSON content. Authentication and project
preconditions are defined in `AUTH-01` and `API-02`; errors are additional to the
successful statuses listed here.

| Method | Path | Request body | Success → response |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | LoginRequest | 200 → TokenResponse / ChallengeResponse |
| `POST` | `/api/v1/auth/logout` | — | 204 → — |
| `POST` | `/api/v1/auth/resend` | ChallengeRequest | 200 → ChallengeResponse |
| `GET` | `/api/v1/auth/session` | — | 200 → SessionResponse |
| `POST` | `/api/v1/auth/verify` | VerifyRequest | 200 → TokenResponse |
| `GET` | `/api/v1/library` | — | 200 → LibraryAsset[] |
| `POST` | `/api/v1/library/bulk-delete` | LibraryAssetsDelete | 204 → — |
| `POST` | `/api/v1/library/uploads` | LibraryUploadCreate | 201 → LibraryUpload |
| `DELETE` | `/api/v1/library/{asset_id}` | — | 204 → — |
| `GET` | `/api/v1/library/{asset_id}` | — | 200 → LibraryAsset |
| `POST` | `/api/v1/library/{asset_id}/complete` | — | 200 → LibraryAsset |
| `PATCH` | `/api/v1/library/{asset_id}/defaults` | LibraryAssetDefaultsUpdate | 200 → LibraryAsset |
| `GET` | `/api/v1/profile/settings` | — | 200 → UserSettings |
| `PATCH` | `/api/v1/profile/settings` | UserSettingsUpdate | 200 → UserSettings |
| `GET` | `/api/v1/projects` | — | 200 → ProjectMetadata[] |
| `POST` | `/api/v1/projects` | ProjectCreate | 201 → ProjectMetadata |
| `DELETE` | `/api/v1/projects/{project_id}` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}` | — | 200 → ProjectMetadata |
| `PATCH` | `/api/v1/projects/{project_id}` | ProjectUpdate | 200 → ProjectMetadata |
| `GET` | `/api/v1/projects/{project_id}/anchors` | — | 200 → Anchor[] |
| `POST` | `/api/v1/projects/{project_id}/anchors` | AnchorCreate | 201 → Anchor |
| `DELETE` | `/api/v1/projects/{project_id}/anchors/{anchor_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/anchors/{anchor_id}` | AnchorUpdate | 200 → Anchor |
| `DELETE` | `/api/v1/projects/{project_id}/camera` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera` | — | 200 → AimTimeline |
| `PATCH` | `/api/v1/projects/{project_id}/camera` | CameraTrackUpdate | 200 → AimTimeline |
| `DELETE` | `/api/v1/projects/{project_id}/camera/depth-of-field` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera/depth-of-field` | — | 200 → DepthOfFieldTimeline |
| `POST` | `/api/v1/projects/{project_id}/camera/depth-of-field` | — | 200 → DepthOfFieldTimeline |
| `POST` | `/api/v1/projects/{project_id}/camera/depth-of-field/keyframes` | DepthOfFieldKeyframeCreate | 201 → DepthOfFieldKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}` | DepthOfFieldKeyframeUpdate | 200 → DepthOfFieldKeyframe |
| `POST` | `/api/v1/projects/{project_id}/camera/keyframes` | CameraKeyframeCreate | 201 → CameraKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/camera/keyframes/{keyframe_id}` | CameraKeyframeUpdate | 200 → CameraKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/lidar` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera/lidar` | — | 200 → LidarTimeline |
| `PATCH` | `/api/v1/projects/{project_id}/camera/lidar` | LidarSettings | 200 → LidarTimeline |
| `DELETE` | `/api/v1/projects/{project_id}/camera/orientation` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera/orientation` | — | 200 → OrientationTimeline |
| `PATCH` | `/api/v1/projects/{project_id}/camera/orientation` | CameraOrientation | 200 → OrientationTimeline |
| `POST` | `/api/v1/projects/{project_id}/camera/orientation/keyframes` | CameraOrientationKeyframeCreate | 201 → CameraOrientationKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}` | CameraOrientationKeyframeUpdate | 200 → CameraOrientationKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/chat` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/chat/messages` | — | 200 → ChatHistoryMessage[] |
| `POST` | `/api/v1/projects/{project_id}/chat/messages` | ChatMessage | 200 → ChatResponse |
| `POST` | `/api/v1/projects/{project_id}/chat/messages/stream` | ChatMessage | 200 → SSE |
| `POST` | `/api/v1/projects/{project_id}/chat/user-messages` | ChatMessage | 201 → ChatHistoryMessage |
| `GET` | `/api/v1/projects/{project_id}/clouds` | — | 200 → ProjectCloud[] |
| `POST` | `/api/v1/projects/{project_id}/clouds` | ProjectCloudCreate | 201 → ProjectCloud |
| `DELETE` | `/api/v1/projects/{project_id}/clouds/{cloud_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/clouds/{cloud_id}` | ProjectCloudUpdate | 200 → ProjectCloud |
| `DELETE` | `/api/v1/projects/{project_id}/motion` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/motion` | — | 200 → MotionProfile |
| `PATCH` | `/api/v1/projects/{project_id}/motion` | MotionProfileUpdate | 200 → MotionProfile |
| `POST` | `/api/v1/projects/{project_id}/motion/keyframes` | SpeedKeyframeCreate | 201 → SpeedKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/motion/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/motion/keyframes/{keyframe_id}` | SpeedKeyframeUpdate | 200 → SpeedKeyframe |
| `POST` | `/api/v1/projects/{project_id}/reset` | — | 200 → ProjectMetadata |
| `GET` | `/api/v1/projects/{project_id}/scene-points` | — | 200 → ScenePoint[] |
| `POST` | `/api/v1/projects/{project_id}/scene-points` | ScenePointCreate | 201 → ScenePoint |
| `DELETE` | `/api/v1/projects/{project_id}/scene-points/{point_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/scene-points/{point_id}` | ScenePointUpdate | 200 → ScenePoint |
| `POST` | `/api/v1/projects/{project_id}/segments/spiral` | SpiralSegmentCreate | 201 → SpiralSegment |
| `POST` | `/api/v1/projects/{project_id}/segments/spline` | SplineSegmentCreate | 201 → SplineSegment |
| `DELETE` | `/api/v1/projects/{project_id}/segments/{segment_id}` | — | 204 → — |
| `DELETE` | `/api/v1/projects/{project_id}/trajectory` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/trajectory` | — | 200 → Trajectory |
| `GET` | `/api/v1/projects/{project_id}/trajectory/compiled` | — | 200 → CompiledTrajectory |

**HTTP-02.** Additional routes used outside OpenAPI:

| Method and path | Contract |
| --- | --- |
| `GET /health` | Liveness, `200 {status:"ok"}` |
| `GET /docs` | Scalar HTML |
| `GET /api/v1/openapi.json` | Generated OpenAPI |
| `PUT /api/v1/library/{asset_id}/content` | Local adapter only, editor, raw bytes → `204`; no project If-Match |
| `GET /api/v1/library/{asset_id}/content` | Local adapter only, public ready bytes |

The unversioned project API is mounted from `routers/api.py`. It provides compatible
project/scene/trajectory/timeline/chat operations with aggregate responses rather
than a separate data model. The existence of `routers/history.py` does not make
undo/redo available.

## 13. Conformance checks

**CHECK-01.** Checks assert behavior and resulting persisted state, including the
absence of partial edits on failure. Required scenarios and existing reference
tests (paths relative to `backend/tests/`):

| Requirements | What to verify | Existing tests |
| --- | --- | --- |
| API-01–07, HTTP-01 | Resource shapes, ETag/If-Match, stale/missing/malformed revision, legacy compatibility, schema | `test_openapi.py`, `test_api.py` |
| PROJECT-01–02, SCENE-01–04, STORE-01–02 | CRUD, reset/clear distinctions, FK/cascade, unrelated data, restart | `test_api.py`, `test_resource_integrity.py`, `test_repository.py`, `test_migration.py`, `test_enum_columns.py` |
| TIME-01–05 | Defaults, duplicate positions, delete/recreate, static LiDAR singleton | `test_delete_timelines.py`, `test_depth_of_field_timeline.py`, `test_lidar_timeline.py` |
| GEOM-01–06 | Endpoints, C² spline, tangent constraints, unchanged spirals, adaptive approximation, distance/time | `test_geometry.py`, `test_trajectory_planner.py` |
| LIB-01–05, CLOUD-01–02 | Real small PLY/SOG bytes, complete/retry, instances/defaults/order, delete rollback | `test_library.py`, `test_s3_library.py`, `test_project_clouds.py`, `test_library_delete.py`, `test_library_bulk_delete.py` |
| AUTH-01–05, PROFILE-01 | Email flow, invalid/replayed tokens, persistent attempts, concurrent verify, logout, partial settings | `test_auth.py`, `test_email_auth.py`, `test_user_settings.py`, `test_config.py` |
| CHAT-01–05 | Idempotent messages, atomic tool edits, history, SSE delta/result/error, unavailable provider | `test_agent.py`, `test_agent_lidar.py`, `test_api.py` |

This is a verification map, not a claim that existing tests prove every edge case.
External-provider behavior and LLM quality are checked separately. A new test should
verify a requirement rather than reproduce an internal algorithm.

**CHECK-02.** For Python backend changes, run from `backend/`:

```bash
uv sync --frozen --extra aws
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

For HTTP schema changes, run `uv run openapi-export openapi.json`, verify artifact
freshness and check generated frontend API compatibility. For documentation-only
changes, check links, the operation/DTO inventory and `git diff --check`; running
the full runtime suite alone does not establish prose accuracy.

**CHECK-03.** Any replacement backend preserves the external contract, permissions,
persisted data and revision semantics, or includes an explicitly agreed specification
change. Numerical comparisons use documented tolerances; byte-for-byte JSON float
equality is unnecessary. The independent CP-118 HTTP acceptance suite is currently
in a separate PR and will add verification once accepted (section 15).

## 14. Limitations and open questions

**GAP-01.** This specification captures the baseline contract without declaring
known bugs desirable behavior.
[CP-117](https://docs.google.com/document/d/1Ql-Ynh-PZ6QIVf6nqycBb2FExjOriIQZMlYG-2VFZmI/edit)
reports revision_conflict on anchor deletion and spiral recreation. Its backend/
frontend cause still needs to be isolated. The requirement remains: a current
revision permits a valid edit; a stale revision produces a conflict without data loss.

**GAP-02.** The HTTP mutation guard uses an in-process lock; database writes use
revision CAS. This promises neither a shared lock across every process nor atomic
reads of several independent HTTP resources. A long agent turn can conflict with
another edit; the client must refetch state. Unlimited automatic retries of LLM
edits are not specified.

**GAP-03.** Uniform mapping of every LLM/compilation/disconnect failure to non-stream
JSON or SSE errors is not yet established. In particular, the stream catch list
does not cover every possible exception. Extending error handling must retain
atomic commit semantics; a missing `result` does not prove rollback when the
connection is lost.

**GAP-04.** There is no complete server-side 3DGS parser/sha256 validation, global
file-count quota or finished lifecycle for expired pending uploads. The current
2 GiB validation limit differs from the planned 1 GB limit. A signed S3 PUT currently
does not prevent oversized bytes from being accepted before complete. New quotas
are covered by `PLAN-03`.

**GAP-05.** Older documents/README text may lag behind the contract. In particular,
descriptions of snapshot undo/redo, a mandatory aim key at zero, a Catmull–Rom planner
or deformation of analytic spirals at spline junctions do not define the current
implementation. Internal Project excludes clouds. Complete project export,
revisioned library/profile, cloud transform editing, compilation caching and
multi-user access are not yet specified.

## 15. Planned changes

Only this section has **planned / outside the current `main` contract** status.
PR status is recorded at the initial baseline date. After merge, update status
and move accepted requirements into the relevant main sections. Links lead to
detailed source tasks; they do not instruct the agent to implement the entire plan.

**PLAN-01. CP-118 — independent HTTP acceptance.**
[Task](https://docs.google.com/document/d/1CqaWyve6LW1tY7ra4lRSYRnQ8I9SzgVkSo-IgYPUaZM/edit),
[draft PR #111](https://github.com/vinneyto/camera_path/pull/111).
A real backend process, isolated SQLite/files and external SMTP/OpenAI fixtures;
the same suite applies to Python and Rust. Cover the operation matrix, concurrency,
authentication, SSE, restart persistence and numerical tolerances. Internal
application mocks do not replace acceptance. Known bugs do not become expected behavior.

**PLAN-02. CP-119 — Rust modular monolith.**
[Task](https://docs.google.com/document/d/1mUXqDCmQ0eoH06N66HiyUO1dvWkLKOgvz0Fnub7tEiY/edit),
[draft PR #112](https://github.com/vinneyto/camera_path/pull/112), based on #111.
Chosen direction: Axum/Tokio/Serde, SeaORM and migrations, Utoipa, retaining SQLite,
API and data. Core **includes ORM, repositories and business logic**, but not
provider SDKs. Separate crates: core, app, storage-local, storage-s3, email-smtp,
email-ses, queue-rabbitmq, queue-sqs and an OpenAI adapter. App composes the environment;
adapters depend on core. HTTP and queue ingress invoke application operations in
one monolith. Use RabbitMQ for development and SQS for AWS, with acknowledgments
after commit, durable deduplication, retries/DLQ. Alembic → SeaORM migration validates
the source schema, preserves IDs/files/auth and is tested on a database copy.
CPU-heavy work runs off the async runtime. Code releases do not recreate infrastructure.
The Go migration in the older CP-81 task is not a parallel plan.

**PLAN-03. CP-116 — library quotas.**
[Task](https://docs.google.com/document/d/1HRMzxC3fAD1d0cDFy-Oz6KrjU583ajUQaWtc7QVJ0B8/edit).
A finite configurable count limit and per-file limit no greater than
**1,000,000,000 bytes**. Check declared/actual sizes for local and direct S3 uploads.
Active reservations count toward the quota; concurrency must not bypass it;
failed/expired uploads release reservations. Reducing limits does not automatically
delete existing assets. The default count, S3 enforcement mechanism and error codes
are implementation decisions still to be made.

**PLAN-04. CP-95 — library metadata and correlation.**
[Task](https://docs.google.com/document/d/1nj0kNZH98IlHocQ5TTRTtXX8YyVk7mykJw71JBFJCPI/edit).
Retain the server primary key; add an immutable `client_id` UUID unique throughout
the environment, nullable `thumbnail_key` and `tags` with finite limits/normalization.
The client can choose an ID in advance or have the backend generate it. Backfill
existing records. Repeating the ID with identical content is idempotent; incompatible
payloads conflict. Provide client_id lookup and thumbnail URLs through the storage
adapter. This is a resource correlation ID, not a credential, job ID or event ID.

**PLAN-05. CP-96/97/99/100 — external generation and result application.**
Built after CP-118/119.
[Import](https://docs.google.com/document/d/1OGkAa-Njnym7wa0hK1-0PEkN1rKosziBrVypiX1OMXk/edit),
[jobs](https://docs.google.com/document/d/1sI5dwmDcSkOu-uuVOuf8KnV08Fl-KGjq7nCIgdKouAo/edit),
[attachment](https://docs.google.com/document/d/1cNRdEdnIj6JTDXkl_5iJ_yeh2Vst2ByfANiRpmFkC8k/edit),
[events](https://docs.google.com/document/d/1mhv3MM9jq8V3ZGt83zR840v-mE6q6enAnOyg6Ek31t0/edit).

- A producer first saves model/thumbnail bytes, then an immutable versioned ready
  manifest with client_id, model key, format, size/hash, title/tags and optional
  job_id/attempt_token. Import validates namespace, bytes, limits and idempotency.
- Generation jobs are durable: queued → running → awaiting_import → succeeded,
  with terminal failed/cancelled states. Lease/heartbeat/fencing reject stale
  attempts. The Trellis worker remains external; inference does not run inside
  a browser HTTP request.
- Match library results by client_id/current attempt. The backend atomically
  attaches one cloud per job using the marker's current transform. Deleted
  projects/markers are not resurrected: retain the library item and use
  attachment_status=target_missing. A referenced anchor is not deleted along
  with its references.
- Persist the change and durable event/outbox in one transaction. A separate
  contract from chat SSE includes event IDs, revisions/cursors, reconnect/replay
  and resync for stale cursors. Delivery may repeat; consumers deduplicate.
  Backend succeeded and readiness in the browser renderer are separate states.

Older CP-96/97 tasks include separate importer/HTTP-hop and database long-poll worker
options. The newer CP-119 decision places queue ingress and application processing
inside the monolith. Reconcile those options and concrete schemas/routes when
implementing; this specification does not require both transports simultaneously.
Separate services, gRPC and Redis are not added automatically. Jobs, the manifest
endpoint and the event stream are not yet in the current backend HTTP inventory.

## 16. Sources and implementation map

This specification was reconstructed from current `main` routes, DTOs, services,
repositories, compiler, migrations and tests, with relevant Drive tasks checked.
Source links help locate implementation; they do not require preserving the same
file structure during refactoring.

| Area | Source |
| --- | --- |
| HTTP composition / errors | [api.py](src/camera_path/api.py), [routers/](src/camera_path/routers/) |
| DTOs and defaults | [models.py](src/camera_path/models.py); DTOs in services/library.py, services/project_clouds.py, services/user_settings.py, routers/auth.py |
| Application operations | [services/](src/camera_path/services/) |
| Revision CAS | [revisions.py](src/camera_path/services/revisions.py), [dependencies.py](src/camera_path/routers/dependencies.py) |
| ORM / repositories / migrations | [persistence/](src/camera_path/persistence/), [repositories/](src/camera_path/repositories/), [alembic/](alembic/) |
| Geometry | [trajectory/](src/camera_path/trajectory/) |
| LLM orchestration / tools | [trajectory_agent.py](src/camera_path/agent/trajectory_agent.py) |
| Local / AWS adapters | [dev/](src/camera_path/dev/), [aws/](src/camera_path/aws/) |
| Runbooks | [backend/README.md](README.md), [infra/README.md](../infra/README.md) |

The [older backend description on Drive](https://docs.google.com/document/d/1JdP6BxfQYExK8O_8P-zR2Y3KAyCSptPIslNsuulDEdg/edit)
provides historical context; its snapshot storage, starting aim key and source map
are outdated. The [task folder](https://drive.google.com/drive/folders/1A5lVOLC88vFn6oN3XXWfNdSckLFRWeYQ)
remains the work plan. Collect newly accepted requirements here so future
implementation does not require reconstructing the contract from conversations
and task documents again.
