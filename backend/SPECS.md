# Camera Path — Backend Specification

The primary document for implementing and changing the backend:
**`backend/SPECS.md → code → tests`**. It defines behavior, data and system boundaries.
A human edits the specification; on an explicit request, an agent brings the
implementation into line with the changed requirements.

This document defines one coherent Python backend contract. Work plans, task
identifiers, implementation progress and review status belong in task documents
and pull requests; they are not part of the backend requirements.

## Contents

- [1. Working with this specification](#1-working-with-this-specification)
- [2. Purpose and scope](#2-purpose-and-scope)
- [3. Entities and defaults](#3-entities-and-defaults)
  - [3.1. Type notation](#31-type-notation)
  - [3.2. Projects and scene entities](#32-projects-and-scene-entities)
    - [ProjectMetadata](#projectmetadata)
    - [Project](#project)
    - [Anchor](#anchor)
    - [ScenePoint](#scenepoint)
    - [SplineSegment](#splinesegment)
    - [SpiralSegment](#spiralsegment)
    - [Trajectory](#trajectory)
  - [3.3. Camera controls and timelines](#33-camera-controls-and-timelines)
    - [FollowPathAim](#followpathaim)
    - [LookAtPointAim](#lookatpointaim)
    - [CameraOrientation](#cameraorientation)
    - [SpeedKeyframe](#speedkeyframe)
    - [CameraKeyframe](#camerakeyframe)
    - [CameraOrientationKeyframe](#cameraorientationkeyframe)
    - [CenterWeightedDepthOfFieldFocus](#centerweighteddepthoffieldfocus)
    - [ScenePointDepthOfFieldFocus](#scenepointdepthoffieldfocus)
    - [DepthOfFieldKeyframe](#depthoffieldkeyframe)
    - [LidarSettings](#lidarsettings)
    - [LidarKeyframe](#lidarkeyframe)
    - [MotionProfile](#motionprofile)
    - [CameraTrack](#cameratrack)
    - [AimTimeline](#aimtimeline)
    - [OrientationTimeline](#orientationtimeline)
    - [DepthOfFieldTimeline](#depthoffieldtimeline)
    - [LidarTimeline](#lidartimeline)
  - [3.4. Compiled trajectory models](#34-compiled-trajectory-models)
    - [CubicBezier3D](#cubicbezier3d)
    - [ArcLengthSample](#arclengthsample)
    - [ResolvedLookAtPointAim](#resolvedlookatpointaim)
    - [ResolvedScenePointDepthOfFieldFocus](#resolvedscenepointdepthoffieldfocus)
    - [CompiledCameraKeyframe](#compiledcamerakeyframe)
    - [CompiledDepthOfFieldKeyframe](#compileddepthoffieldkeyframe)
    - [CompiledMotionProfile](#compiledmotionprofile)
    - [CompiledCameraTrack](#compiledcameratrack)
    - [CompiledTrajectory](#compiledtrajectory)
  - [3.5. Library, cloud and profile resources](#35-library-cloud-and-profile-resources)
    - [LibraryAsset](#libraryasset)
    - [LibraryAssetFile](#libraryassetfile)
    - [Job](#job)
    - [LibraryUpload](#libraryupload)
    - [ProjectCloud](#projectcloud)
    - [UserSettings](#usersettings)
  - [3.6. Chat, authentication responses and errors](#36-chat-authentication-responses-and-errors)
    - [ChatHistoryMessage](#chathistorymessage)
    - [ChatHistory](#chathistory)
    - [ChatMessage](#chatmessage)
    - [ChatResponse](#chatresponse)
    - [ChatResult](#chatresult)
    - [TokenResponse](#tokenresponse)
    - [ChallengeResponse](#challengeresponse)
    - [SessionResponse](#sessionresponse)
    - [FieldError](#fielderror)
    - [ErrorResponse](#errorresponse)
  - [3.7. Creation and update requests](#37-creation-and-update-requests)
    - [ProjectCreate](#projectcreate)
    - [ProjectUpdate](#projectupdate)
    - [AnchorCreate](#anchorcreate)
    - [AnchorUpdate](#anchorupdate)
    - [ScenePointCreate](#scenepointcreate)
    - [ScenePointUpdate](#scenepointupdate)
    - [SplineSegmentCreate](#splinesegmentcreate)
    - [SpiralSegmentCreate](#spiralsegmentcreate)
    - [MotionProfileUpdate](#motionprofileupdate)
    - [SpeedKeyframeCreate](#speedkeyframecreate)
    - [SpeedKeyframeUpdate](#speedkeyframeupdate)
    - [CameraTrackUpdate](#cameratrackupdate)
    - [CameraKeyframeCreate](#camerakeyframecreate)
    - [CameraKeyframeUpdate](#camerakeyframeupdate)
    - [CameraOrientationKeyframeCreate](#cameraorientationkeyframecreate)
    - [CameraOrientationKeyframeUpdate](#cameraorientationkeyframeupdate)
    - [DepthOfFieldKeyframeCreate](#depthoffieldkeyframecreate)
    - [DepthOfFieldKeyframeUpdate](#depthoffieldkeyframeupdate)
    - [LibraryUploadCreate](#libraryuploadcreate)
    - [LibraryAssetDefaultsUpdate](#libraryassetdefaultsupdate)
    - [LibraryAssetsDelete](#libraryassetsdelete)
    - [ProjectCloudCreate](#projectcloudcreate)
    - [ProjectCloudUpdate](#projectcloudupdate)
    - [UserSettingsUpdate](#usersettingsupdate)
    - [LoginRequest](#loginrequest)
    - [ChallengeRequest](#challengerequest)
    - [VerifyRequest](#verifyrequest)
  - [3.8. Job completion messages](#38-job-completion-messages)
    - [LibraryFileSource](#libraryfilesource)
    - [LibraryImportFile](#libraryimportfile)
    - [JobCompletionAsset](#jobcompletionasset)
    - [JobCompletionMessage](#jobcompletionmessage)
- [4. HTTP, revisions and errors](#4-http-revisions-and-errors)
- [5. Projects and scene editing](#5-projects-and-scene-editing)
- [6. Timelines](#6-timelines)
- [7. Trajectory compilation](#7-trajectory-compilation)
- [8. Library and project clouds](#8-library-and-project-clouds)
  - [8.1. Library identity, tags and thumbnails](#81-library-identity-tags-and-thumbnails)
  - [8.2. Multiple files and job results](#82-multiple-files-and-job-results)
  - [8.3. Message queue boundary and adapters](#83-message-queue-boundary-and-adapters)
  - [8.4. Jobs and result lifecycle](#84-jobs-and-result-lifecycle)
- [9. Authentication and profile](#9-authentication-and-profile)
- [10. Chat and agent](#10-chat-and-agent)
- [11. Persistence, configuration and operations](#11-persistence-configuration-and-operations)
  - [11.1. Record conventions and supporting types](#111-record-conventions-and-supporting-types)
  - [11.2. Persisted enums](#112-persisted-enums)
  - [11.3. Record catalogue](#113-record-catalogue)
    - [UserSettingsRecord](#usersettingsrecord--user_settings)
    - [ProjectRecord](#projectrecord--projects)
    - [LibraryAssetRecord](#libraryassetrecord--library_assets)
    - [LibraryAssetFileRecord](#libraryassetfilerecord--library_asset_files)
    - [JobRecord](#jobrecord--jobs)
    - [ProjectCloudRecord](#projectcloudrecord--project_clouds)
    - [AnchorRecord](#anchorrecord--anchors)
    - [ScenePointRecord](#scenepointrecord--scene_points)
    - [TrajectorySegmentRecord](#trajectorysegmentrecord--trajectory_segments)
    - [SegmentAnchorRecord](#segmentanchorrecord--segment_anchors)
    - [MotionProfileRecord](#motionprofilerecord--motion_profiles)
    - [SpeedKeyframeRecord](#speedkeyframerecord--speed_keyframes)
    - [CameraTrackRecord](#cameratrackrecord--camera_tracks)
    - [AimKeyframeRecord](#aimkeyframerecord--aim_keyframes)
    - [OrientationKeyframeRecord](#orientationkeyframerecord--orientation_keyframes)
    - [DepthOfFieldKeyframeRecord](#depthoffieldkeyframerecord--depth_of_field_keyframes)
    - [LidarKeyframeRecord](#lidarkeyframerecord--lidar_keyframes)
    - [EditorRecord](#editorrecord--editors)
    - [EditorSessionRecord](#editorsessionrecord--editor_sessions)
    - [ChatMessageRecord](#chatmessagerecord--chat_messages)
    - [AuthChallengeRecord](#authchallengerecord--auth_challenges)
    - [AuthRateLimitRecord](#authratelimitrecord--auth_rate_limits)
  - [11.4. Database constraints and service mapping](#114-database-constraints-and-service-mapping)
  - [11.5. Schema upgrades and identifier lifecycle](#115-schema-upgrades-and-identifier-lifecycle)
  - [11.6. Configuration and operations](#116-configuration-and-operations)
- [12. HTTP operation inventory](#12-http-operation-inventory)
- [13. Conformance checks](#13-conformance-checks)
- [14. Limitations and open questions](#14-limitations-and-open-questions)
- [15. Sources and implementation map](#15-sources-and-implementation-map)

## 1. Working with this specification

**SPEC-01. Authority.** Once accepted, this document defines expected backend
behavior. Code implements the requirements and tests verify them; any discrepancy
must be identified explicitly. An implementation bug must not automatically become
a requirement. OpenAPI is the precise machine-readable HTTP contract, generated from
the implementation. It must agree with this specification rather than act as an
independent source of product decisions. READMEs contain run instructions; Drive
tasks preserve history, plans and acceptance criteria for individual changes.

**SPEC-02. Changes.** First commit the changed specification for review. Wait for
the user's explicit go-ahead before committing implementation and tests. Both
stages may use the same PR. Identify affected operations, data, migrations and
clients; explain contradictions rather than silently choosing incompatible
behavior. A further requirement change needs its own specification commit and
go-ahead before implementation.

**SPEC-03. Change scope.** Editing this document alone does not trigger implementation.
A change covers the requested requirements. Execution plans, backlog priorities
and implementation progress remain outside this specification.
This document is not an automatically executable code generator.

**SPEC-04. Stable references.** Keep identifiers such as `API-01` and `LIB-02` when
moving text; do not reuse retired numbers. Give each new requirement a new number.
A PR identifies affected requirements, completed checks and remaining discrepancies.
A material behavior change includes a specification update, OpenAPI/client changes
when HTTP changes, and a migration when persisted data changes.

**SPEC-05. Document structure.** State the backend contract directly, without
task-specific sections, task identifiers or per-change implementation-status notes.
Integrate changed requirements into the corresponding models, records, API and
behavior sections. Keep the contents nested by section, with a link to every
named model and record. Track implementation gaps and review decisions in the PR.

## 2. Purpose and scope

**SCOPE-01.** The backend serves a 3D camera-path editor. It stores projects and scene
data, semantic paths, motion and camera controls, a shared 3DGS library and its
instances in projects, and tracks jobs with their library results.
It compiles paths into playback data and provides chat with
an agent that can edit an allowed subset of project resources.

**SCOPE-02.** Authoring data and compiled trajectories are separate. Compilation is
a derived read that does not modify the project. Splat rendering, picking, camera
evaluation per frame, autofocus and LiDAR intersections run on the client. Ordinary
file uploads do not make the backend decode or train 3DGS models.

**SCOPE-03.** Data is shared and published: guests read it; one authenticated editor
can change it. There are currently no private user projects, public registration,
multiple-editor roles or per-user libraries. Core geometry and REST operations work
without OpenAI credentials. External job completions arrive through a message
broker, separately from the ordinary editor HTTP API.

## 3. Entities and defaults

**DATA-01.** IDs are strings. New projects, scene entities, keyframes, assets, jobs
and cloud instances receive server-generated UUIDs. Authentication challenges use a
separate opaque ID. Scene references resolve within their project. Segment, message
and cloud ordering is preserved. A JSON `Vec3` is `[x, y, z]`. Coordinates and lengths
use scene units; they represent meters and meters per second when the scene scale
is metric.

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

**DATA-04. Field catalogue.** Each model below lists every field, including
inherited fields. Public resources, internal aggregates and request DTOs are
identified separately. These tables define resource contracts, not database column
layouts or permission to edit response-only fields.

- [Projects and scene entities](#32-projects-and-scene-entities)
- [Camera controls and timelines](#33-camera-controls-and-timelines)
- [Compiled trajectory models](#34-compiled-trajectory-models)
- [Library, cloud and profile resources](#35-library-cloud-and-profile-resources)
- [Chat, authentication responses and errors](#36-chat-authentication-responses-and-errors)
- [Creation and update requests](#37-creation-and-update-requests)
- [Job completion messages](#38-job-completion-messages)

**DATA-05. Models and records.** A **model** is a Pydantic service/domain or
request/response model: it defines validated application data and supports
Pydantic serialization to JSON-compatible data. Common service models live in
`camera_path/models.py`; service-specific DTOs may remain in their existing
service/router modules. Models are not SQLAlchemy table mappings.

A **record** is a SQLAlchemy ORM representation of database state, including
columns, keys, constraints and relationships. Record classes use the `Record`
suffix. Domain records live in `camera_path/persistence/records.py`.
Repositories, services, Alembic metadata loading and tests import records from
that module. Queue delivery state belongs to the external broker, not SQL records.
The complete record catalogue is in [section 11.3](#113-record-catalogue). Repositories
and services map records to/from serializable models; database records are not
the public serialization contract.

Python module paths are separate from database identifiers. Record class names,
table/column names, SQLAlchemy metadata and migration history define persistence;
serializable service models define the external data contract.

### 3.1. Type notation

| Type | Meaning |
| --- | --- |
| `string`, `number`, `integer`, `boolean` | JSON string, floating-point number, whole number and boolean |
| `FiniteNumber` | A number excluding NaN and infinities |
| `Vec3` | Exactly three numbers: `[number, number, number]`, serialized as a JSON array |
| `FiniteVec3` | A Vec3 with three finite components |
| `DateTime` | ISO 8601 date-time string in JSON; Python datetime internally |
| `Array<T>` | Ordered array of values of type T |
| `Record<string, T>` | JSON object mapping string IDs to values of type T; unrelated to ORM record classes |
| `T \| null` | The field accepts null; this is separate from omitting the field |
| `Interpolation` | `"smoothstep" \| "linear" \| "hold"` |
| `AssetFormat` | `"ply" \| "sog"` |
| `TrajectorySegment` | `SplineSegment \| SpiralSegment`, discriminated by kind |
| `CameraAim` | `FollowPathAim \| LookAtPointAim`, discriminated by kind |
| `DepthOfFieldFocus` | `CenterWeightedDepthOfFieldFocus \| ScenePointDepthOfFieldFocus`, discriminated by kind |
| `ResolvedCameraAim` | `FollowPathAim \| ResolvedLookAtPointAim`, discriminated by kind |
| `ResolvedDepthOfFieldFocus` | `CenterWeightedDepthOfFieldFocus \| ResolvedScenePointDepthOfFieldFocus`, discriminated by kind |

**Required** describes whether model validation requires a supplied field. **Default**
is the model initializer when omitted, including factories; service/database defaults
are labeled separately. Response fields are serialized according to the endpoint;
an optional model field is not necessarily omitted from a response. For PATCH,
omission preserves existing state. Nullable fields in the current resource update
DTOs are ignored when null; null does not delete a resource or reset its value.
Constraints in the tables supplement the domain rules in later sections.

### 3.2. Projects and scene entities

#### ProjectMetadata

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | — |
| `name` | `string` | Yes | — | — |
| `revision` | `integer` | Yes | — | — |
| `anchor_count` | `integer` | Yes | — | Computed from current anchors |
| `segment_count` | `integer` | Yes | — | Computed from current segments |

#### Project

Internal authoring aggregate; canonical project reads return ProjectMetadata. Cloud instances are separate resources.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | Generated UUID | — |
| `name` | `string` | No | `"Untitled camera path"` | Min length: 1; Max length: 128 |
| `revision` | `integer` | No | `0` | Shared project revision |
| `anchors` | `Record<string, Anchor>` | No | `{}` | — |
| `scene_points` | `Record<string, ScenePoint>` | No | `{}` | — |
| `segments` | `Array<TrajectorySegment>` | No | `[]` | — |
| `camera_track` | `CameraTrack` | No | CameraTrack defaults | — |
| `motion_profile` | `MotionProfile` | No | MotionProfile defaults | — |
| `chat_history` | `Array<ChatHistoryMessage>` | No | `[]` | — |

#### Anchor

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `label` | `string` | Yes | — | Min length: 1; Max length: 64 |
| `surface_position` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `surface_normal` | `Vec3` | No | `[0.0,1.0,0.0]` | Min items: 3; Max items: 3; Nonzero when supplied |
| `lift` | `number` | No | `0.0` | — |
| `lift_axis` | `"world_up" \| "surface_normal"` | No | `"world_up"` | — |
| `id` | `string` | No | Generated UUID | — |

#### ScenePoint

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `label` | `string` | Yes | — | Min length: 1; Max length: 64 |
| `position` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `id` | `string` | No | Generated UUID | — |

#### SplineSegment

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `anchor_ids` | `Array<string>` | Yes | — | Min items: 2 |
| `tension` | `number` | No | `0.0` | >= 0.0; <= 1.0 |
| `id` | `string` | No | Generated UUID | — |
| `kind` | `"spline"` | No | `"spline"` | — |

#### SpiralSegment

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `start_anchor_id` | `string` | Yes | — | — |
| `center_anchor_id` | `string` | Yes | — | — |
| `end_anchor_id` | `string` | Yes | — | — |
| `turns` | `number` | No | `1.0` | > 0.0; <= 100.0 |
| `direction` | `"cw" \| "ccw"` | No | `"ccw"` | — |
| `radial_law` | `"linear" \| "smoothstep"` | No | `"smoothstep"` | — |
| `axial_law` | `"linear" \| "smoothstep"` | No | `"smoothstep"` | — |
| `id` | `string` | No | Generated UUID | — |
| `kind` | `"spiral"` | No | `"spiral"` | — |

#### Trajectory

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `segments` | `Array<TrajectorySegment>` | No | `[]` | — |

### 3.3. Camera controls and timelines

#### FollowPathAim

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `kind` | `"follow_path"` | No | `"follow_path"` | — |
| `direction` | `"forward" \| "backward"` | No | `"forward"` | — |

#### LookAtPointAim

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `kind` | `"look_at_point"` | No | `"look_at_point"` | — |
| `scene_point_id` | `string` | Yes | — | — |

#### CameraOrientation

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `yaw_deg` | `FiniteNumber` | No | `0.0` | — |
| `pitch_deg` | `FiniteNumber` | No | `0.0` | — |
| `roll_deg` | `FiniteNumber` | No | `0.0` | — |

#### SpeedKeyframe

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `speed` | `number` | Yes | — | > 0.0 |
| `interpolation_to_next` | `Interpolation` | No | `"smoothstep"` | — |
| `id` | `string` | No | Generated UUID | — |

#### CameraKeyframe

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `aim` | `CameraAim` | Yes | — | Discriminator: kind |
| `interpolation_to_next` | `Interpolation` | No | `"smoothstep"` | — |
| `id` | `string` | No | Generated UUID | — |

#### CameraOrientationKeyframe

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `orientation` | `CameraOrientation` | Yes | — | — |
| `interpolation_to_next` | `Interpolation` | No | `"smoothstep"` | — |
| `id` | `string` | No | Generated UUID | — |

#### CenterWeightedDepthOfFieldFocus

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `kind` | `"center_weighted_9"` | No | `"center_weighted_9"` | — |

#### ScenePointDepthOfFieldFocus

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `kind` | `"scene_point"` | No | `"scene_point"` | — |
| `scene_point_id` | `string` | Yes | — | — |

#### DepthOfFieldKeyframe

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `focus` | `DepthOfFieldFocus` | No | CenterWeightedDepthOfFieldFocus defaults | Discriminator: kind |
| `focus_range_scale` | `number` | No | `0.25` | > 0.0 |
| `bokeh_scale` | `number` | No | `6.0` | >= 0.0 |
| `id` | `string` | No | Generated UUID | — |

#### LidarSettings

Only supplied fields replace existing singleton settings; an empty object creates defaults when absent. Unknown fields are rejected.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `vertical_fov_deg` | `FiniteNumber` | No | `60.0` | > 0.0; < 180.0 |
| `horizontal_resolution` | `integer` | No | `512` | >= 1.0; <= 4096.0; Strict integer |
| `vertical_resolution` | `integer` | No | `32` | >= 1.0; <= 256.0; Strict integer |

#### LidarKeyframe

Unknown fields are rejected.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `vertical_fov_deg` | `FiniteNumber` | No | `60.0` | > 0.0; < 180.0 |
| `horizontal_resolution` | `integer` | No | `512` | >= 1.0; <= 4096.0; Strict integer |
| `vertical_resolution` | `integer` | No | `32` | >= 1.0; <= 256.0; Strict integer |
| `id` | `string` | No | Generated UUID | — |
| `path_position` | `0.0` | No | `0.0` | — |

#### MotionProfile

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_speed` | `number` | No | `1.0` | > 0.0 |
| `keyframes` | `Record<string, SpeedKeyframe>` | No | `{}` | — |

#### CameraTrack

Internal aggregate assembled from the separate camera timeline resources.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_aim` | `CameraAim` | No | FollowPathAim defaults | Discriminator: kind |
| `keyframes` | `Record<string, CameraKeyframe>` | No | `{}` | — |
| `default_orientation` | `CameraOrientation` | No | CameraOrientation defaults | — |
| `orientation_keyframes` | `Record<string, CameraOrientationKeyframe>` | No | `{}` | — |
| `depth_of_field_keyframes` | `Record<string, DepthOfFieldKeyframe>` | No | `{}` | — |
| `lidar_keyframe` | `LidarKeyframe \| null` | No | `null` | — |
| `world_up` | `Vec3` | No | `[0.0,1.0,0.0]` | Min items: 3; Max items: 3; Nonzero; checked by project validation |

#### AimTimeline

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_aim` | `CameraAim` | No | FollowPathAim defaults | Discriminator: kind |
| `keyframes` | `Record<string, CameraKeyframe>` | No | `{}` | — |
| `world_up` | `Vec3` | No | `[0.0,1.0,0.0]` | Min items: 3; Max items: 3; Nonzero; checked by project validation |

#### OrientationTimeline

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_orientation` | `CameraOrientation` | No | CameraOrientation defaults | — |
| `keyframes` | `Record<string, CameraOrientationKeyframe>` | No | `{}` | — |

#### DepthOfFieldTimeline

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `keyframes` | `Record<string, DepthOfFieldKeyframe>` | No | `{}` | — |

#### LidarTimeline

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `lidar_keyframe` | `LidarKeyframe \| null` | No | `null` | — |

### 3.4. Compiled trajectory models

#### CubicBezier3D

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `source_segment_id` | `string` | Yes | — | Authoring segment ID |
| `p0` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `p1` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `p2` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `p3` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `length` | `number` | Yes | — | — |

#### ArcLengthSample

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `segment_index` | `integer` | Yes | — | — |
| `t` | `number` | Yes | — | Local curve parameter in [0,1] |
| `distance` | `number` | Yes | — | Cumulative distance over the whole path |

#### ResolvedLookAtPointAim

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `kind` | `"look_at_point"` | No | `"look_at_point"` | — |
| `scene_point_id` | `string` | Yes | — | — |
| `position` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |

#### ResolvedScenePointDepthOfFieldFocus

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `kind` | `"scene_point"` | No | `"scene_point"` | — |
| `scene_point_id` | `string` | Yes | — | — |
| `position` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |

#### CompiledCameraKeyframe

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | — |
| `path_position` | `number` | Yes | — | — |
| `aim` | `ResolvedCameraAim` | Yes | — | Discriminator: kind |
| `interpolation_to_next` | `Interpolation` | Yes | — | — |

#### CompiledDepthOfFieldKeyframe

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | — |
| `path_position` | `number` | Yes | — | — |
| `focus` | `ResolvedDepthOfFieldFocus` | Yes | — | Discriminator: kind |
| `focus_range_scale` | `number` | Yes | — | — |
| `bokeh_scale` | `number` | Yes | — | — |

#### CompiledMotionProfile

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_speed` | `number` | Yes | — | — |
| `keyframes` | `Array<SpeedKeyframe>` | Yes | — | — |

#### CompiledCameraTrack

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_aim` | `ResolvedCameraAim` | Yes | — | Discriminator: kind |
| `keyframes` | `Array<CompiledCameraKeyframe>` | Yes | — | — |
| `default_orientation` | `CameraOrientation` | Yes | — | — |
| `orientation_keyframes` | `Array<CameraOrientationKeyframe>` | Yes | — | — |
| `depth_of_field_keyframes` | `Array<CompiledDepthOfFieldKeyframe>` | Yes | — | — |
| `world_up` | `Vec3` | Yes | — | Min items: 3; Max items: 3; Nonzero; checked by project validation |

#### CompiledTrajectory

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `project_id` | `string` | Yes | — | — |
| `revision` | `integer` | Yes | — | — |
| `position_segments` | `Array<CubicBezier3D>` | Yes | — | — |
| `arc_length_table` | `Array<ArcLengthSample>` | Yes | — | — |
| `total_length` | `number` | Yes | — | — |
| `duration_seconds` | `number` | Yes | — | — |
| `motion_profile` | `CompiledMotionProfile` | Yes | — | — |
| `camera_track` | `CompiledCameraTrack` | Yes | — | — |
| `warnings` | `Array<string>` | No | `[]` | — |

### 3.5. Library, cloud and profile resources

#### LibraryAsset

Public asset model. Object keys and producer source locations are internal metadata,
not public URL fields. The scalar format/size/download fields describe the primary
file; `files` describes all alternatives belonging to the same logical item.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Server-assigned primary key |
| `job_id` | `string (UUID) \| null` | No | `null` | Producing job; null for manual/ungrouped assets |
| `name` | `string` | Yes | — | — |
| `format` | `AssetFormat` | Yes | — | Primary file format; LIB-13 |
| `size_bytes` | `integer` | Yes | — | Primary file byte count, not the total; LIB-13 |
| `status` | `"pending" \| "ready"` | Yes | — | — |
| `created_at` | `DateTime` | Yes | — | — |
| `tags` | `Array<string>` | Yes | `[]` | Normalized, bounded and deduplicated; LIB-08 |
| `thumbnail_url` | `string \| null` | No | `null` | Computed through storage; LIB-09 |
| `download_url` | `string \| null` | No | `null` | Computed on read; null when not provided |
| `primary_file_id` | `string` | Yes | — | ID of exactly one entry in files |
| `files` | `Array<LibraryAssetFile>` | Yes | — | Nonempty ordered collection; pending URLs are null |
| `default_rotation_deg` | `FiniteVec3` | Yes | — | Min items: 3; Max items: 3; New asset value: [0,0,0] |
| `default_scale` | `FiniteNumber` | Yes | — | > 0.0; New asset value: 1 |
| `default_offset` | `FiniteVec3` | Yes | — | Min items: 3; Max items: 3; New asset value: [0,0,0] |

#### LibraryAssetFile

One downloadable representation of an asset. File IDs are stable within their
asset, not global UUIDs; destination object names are separate UUIDs.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Asset-scoped ID, 1–64 ASCII letters/digits/underscores/hyphens |
| `format` | `AssetFormat` | Yes | — | File representation; currently ply or sog |
| `size_bytes` | `integer` | Yes | — | Positive, at most 2 GiB per file |
| `sha256` | `string \| null` | No | `null` | Verified lowercase 64-digit hex; null for unhashed legacy/manual files |
| `download_url` | `string \| null` | No | `null` | Adapter-generated URL; null while the asset is pending |

#### Job

Public minimal job state. Assets are returned in their original result order,
with current download URLs. Completion does not depend on the surviving list size.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string (UUID)` | Yes | — | Server-generated nonzero UUIDv4 |
| `completed_at` | `DateTime \| null` | Yes | — | Null until the complete result commits; UTC completion time afterwards |
| `assets` | `Array<LibraryAsset>` | Yes | — | Empty on creation; surviving results ordered by job_position |

#### LibraryUpload

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Server primary key |
| `job_id` | `string (UUID) \| null` | No | `null` | Producing job; null for manual/ungrouped assets |
| `name` | `string` | Yes | — | — |
| `format` | `AssetFormat` | Yes | — | Primary file format; LIB-13 |
| `size_bytes` | `integer` | Yes | — | Primary file byte count, not the total; LIB-13 |
| `status` | `"pending" \| "ready"` | Yes | — | — |
| `created_at` | `DateTime` | Yes | — | — |
| `tags` | `Array<string>` | Yes | `[]` | LIB-08 |
| `thumbnail_url` | `string \| null` | No | `null` | Null while pending; LIB-09 |
| `download_url` | `string \| null` | No | `null` | Computed on read; null when not provided |
| `primary_file_id` | `string` | Yes | — | ID of exactly one entry in files |
| `files` | `Array<LibraryAssetFile>` | Yes | — | Nonempty ordered collection; pending URLs are null |
| `default_rotation_deg` | `FiniteVec3` | Yes | — | Min items: 3; Max items: 3 |
| `default_scale` | `FiniteNumber` | Yes | — | > 0.0 |
| `default_offset` | `FiniteVec3` | Yes | — | Min items: 3; Max items: 3 |
| `upload_url` | `string` | Yes | — | PUT URL for this new pending manual upload; LIB-07 |

#### ProjectCloud

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | — |
| `project_id` | `string` | Yes | — | — |
| `library_asset_id` | `string` | Yes | — | — |
| `name` | `string` | Yes | — | — |
| `format` | `AssetFormat` | Yes | — | — |
| `position` | `integer` | Yes | — | Ordered instance index |
| `visible` | `boolean` | Yes | — | — |
| `download_url` | `string` | Yes | — | Resolved by storage adapter |
| `translation` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `rotation_deg` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `scale` | `number` | Yes | — | — |
| `offset` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |

#### UserSettings

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `webgpu_tile_renderer` | `boolean` | Yes | — | Service fallback: false |
| `show_grid` | `boolean` | Yes | — | Service fallback: true |
| `gaussian_dpr` | `"1x" \| "system"` | No | `"1x"` | — |

### 3.6. Chat, authentication responses and errors

#### ChatHistoryMessage

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | Generated UUID | — |
| `role` | `"user" \| "assistant"` | Yes | — | — |
| `content` | `string` | Yes | — | — |

#### ChatHistory

Internal/legacy history wrapper; canonical message listing returns an array.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `messages` | `Array<ChatHistoryMessage>` | No | `[]` | — |

#### ChatMessage

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | Generated UUID | — |
| `message` | `string` | Yes | — | Min length: 1; Max length: 10000 |

#### ChatResponse

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `answer` | `string` | Yes | — | — |
| `compiled` | `CompiledTrajectory` | Yes | — | — |

#### ChatResult

Internal/legacy agent result; canonical chat uses ChatResponse.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `answer` | `string` | Yes | — | — |
| `project` | `Project` | Yes | — | — |
| `compiled` | `CompiledTrajectory` | Yes | — | — |

#### TokenResponse

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `access_token` | `string` | Yes | — | — |
| `token_type` | `string` | No | `"bearer"` | — |
| `expires_in` | `integer` | Yes | — | — |

#### ChallengeResponse

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `challenge_id` | `string` | Yes | — | — |
| `expires_in` | `integer` | Yes | — | — |
| `resend_after` | `integer` | Yes | — | — |

#### SessionResponse

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `username` | `string` | Yes | — | — |

#### FieldError

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `location` | `Array<string \| integer>` | Yes | — | — |
| `message` | `string` | Yes | — | — |
| `type` | `string` | Yes | — | — |

#### ErrorResponse

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `code` | `string` | Yes | — | — |
| `detail` | `string` | Yes | — | — |
| `field_errors` | `Array<FieldError> \| null` | No | `null` | — |

### 3.7. Creation and update requests

#### ProjectCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `name` | `string` | No | `"Untitled camera path"` | Min length: 1; Max length: 128 |

#### ProjectUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `name` | `string` | Yes | — | Min length: 1; Max length: 128 |

#### AnchorCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `label` | `string` | Yes | — | Min length: 1; Max length: 64 |
| `surface_position` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |
| `surface_normal` | `Vec3` | No | `[0.0,1.0,0.0]` | Min items: 3; Max items: 3; Nonzero when supplied |
| `lift` | `number` | No | `0.0` | — |
| `lift_axis` | `"world_up" \| "surface_normal"` | No | `"world_up"` | — |

#### AnchorUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `label` | `string \| null` | No | `null` | Min length: 1; Max length: 64 |
| `surface_position` | `Vec3 \| null` | No | `null` | Min items: 3; Max items: 3 |
| `surface_normal` | `Vec3 \| null` | No | `null` | Min items: 3; Max items: 3; Nonzero when supplied |
| `lift` | `number \| null` | No | `null` | — |
| `lift_axis` | `"world_up" \| "surface_normal" \| null` | No | `null` | — |

#### ScenePointCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `label` | `string` | Yes | — | Min length: 1; Max length: 64 |
| `position` | `Vec3` | Yes | — | Min items: 3; Max items: 3 |

#### ScenePointUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `label` | `string \| null` | No | `null` | Min length: 1; Max length: 64 |
| `position` | `Vec3 \| null` | No | `null` | Min items: 3; Max items: 3 |

#### SplineSegmentCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `anchor_ids` | `Array<string>` | Yes | — | Min items: 2 |
| `tension` | `number` | No | `0.0` | >= 0.0; <= 1.0 |

#### SpiralSegmentCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `start_anchor_id` | `string` | Yes | — | — |
| `center_anchor_id` | `string` | Yes | — | — |
| `end_anchor_id` | `string` | Yes | — | — |
| `turns` | `number` | No | `1.0` | > 0.0; <= 100.0 |
| `direction` | `"cw" \| "ccw"` | No | `"ccw"` | — |
| `radial_law` | `"linear" \| "smoothstep"` | No | `"smoothstep"` | — |
| `axial_law` | `"linear" \| "smoothstep"` | No | `"smoothstep"` | — |

#### MotionProfileUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_speed` | `number` | Yes | — | > 0.0 |

#### SpeedKeyframeCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `speed` | `number` | Yes | — | > 0.0 |
| `interpolation_to_next` | `Interpolation` | No | `"smoothstep"` | — |

#### SpeedKeyframeUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number \| null` | No | `null` | >= 0.0; <= 1.0 |
| `speed` | `number \| null` | No | `null` | > 0.0 |
| `interpolation_to_next` | `Interpolation \| null` | No | `null` | — |

#### CameraTrackUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_aim` | `CameraAim \| null` | No | `null` | Discriminator: kind |
| `world_up` | `Vec3 \| null` | No | `null` | Min items: 3; Max items: 3; Nonzero; checked by project validation |

#### CameraKeyframeCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `aim` | `CameraAim` | Yes | — | Discriminator: kind |
| `interpolation_to_next` | `Interpolation` | No | `"smoothstep"` | — |

#### CameraKeyframeUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number \| null` | No | `null` | >= 0.0; <= 1.0 |
| `aim` | `CameraAim \| null` | No | `null` | Discriminator: kind |
| `interpolation_to_next` | `Interpolation \| null` | No | `null` | — |

#### CameraOrientationKeyframeCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `orientation` | `CameraOrientation` | Yes | — | — |
| `interpolation_to_next` | `Interpolation` | No | `"smoothstep"` | — |

#### CameraOrientationKeyframeUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number \| null` | No | `null` | >= 0.0; <= 1.0 |
| `orientation` | `CameraOrientation \| null` | No | `null` | — |
| `interpolation_to_next` | `Interpolation \| null` | No | `null` | — |

#### DepthOfFieldKeyframeCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number` | Yes | — | >= 0.0; <= 1.0 |
| `focus` | `DepthOfFieldFocus` | No | CenterWeightedDepthOfFieldFocus defaults | Discriminator: kind |
| `focus_range_scale` | `number` | No | `0.25` | > 0.0 |
| `bokeh_scale` | `number` | No | `6.0` | >= 0.0 |

#### DepthOfFieldKeyframeUpdate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `path_position` | `number \| null` | No | `null` | >= 0.0; <= 1.0 |
| `focus` | `DepthOfFieldFocus \| null` | No | `null` | Discriminator: kind |
| `focus_range_scale` | `number \| null` | No | `null` | > 0.0 |
| `bokeh_scale` | `number \| null` | No | `null` | >= 0.0 |

#### LibraryUploadCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `name` | `string` | Yes | — | Min length: 1; Max length: 200 |
| `size_bytes` | `integer` | Yes | — | > 0.0; <= 2147483648.0 |
| `format` | `AssetFormat` | No | `"ply"` | — |
| `thumbnail_key` | `string \| null` | No | `null` | Existing thumbnail object relative to storage root; LIB-09 |
| `tags` | `Array<string>` | No | `[]` | Strict strings, at most 20 input entries; LIB-08 |

`thumbnail_key` is an input/persistence field, not a public response field.
This request reserves a fresh manual upload, not a claim that model bytes have
been verified. It accepts neither a job ID nor producer-assigned asset IDs; reject
unknown fields. Job results are created only by completion processing.

#### LibraryAssetDefaultsUpdate

Rotation and scale are required. An omitted/null offset preserves the stored offset.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `default_rotation_deg` | `FiniteVec3` | Yes | — | Min items: 3; Max items: 3 |
| `default_scale` | `FiniteNumber` | Yes | — | > 0.0 |
| `default_offset` | `FiniteVec3 \| null` | No | `null` | Min items: 3; Max items: 3 |

#### LibraryAssetsDelete

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `asset_ids` | `Array<string>` | Yes | — | Min items: 1 |

#### ProjectCloudCreate

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `library_asset_id` | `string` | Yes | — | — |
| `translation` | `FiniteVec3` | No | `[0,0,0]` | Min items: 3; Max items: 3 |

#### ProjectCloudUpdate

At least one of position or visible must be non-null.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `position` | `integer \| null` | No | `null` | >= 0.0 |
| `visible` | `boolean \| null` | No | `null` | — |

#### UserSettingsUpdate

Only supplied fields are saved; omitted fields preserve existing settings despite model defaults. Unknown fields are rejected.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `webgpu_tile_renderer` | `boolean` | No | `false` | Strict boolean |
| `show_grid` | `boolean` | No | `true` | Strict boolean |
| `gaussian_dpr` | `"1x" \| "system"` | No | `"1x"` | — |

#### LoginRequest

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `username` | `string` | Yes | — | Min length: 1; Max length: 128 |
| `password` | `string` | Yes | — | Min length: 1; Max length: 1024; Secret; write-only |

#### ChallengeRequest

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `challenge_id` | `string` | Yes | — | Min length: 32; Max length: 64; Pattern: `^[A-Za-z0-9_-]+$` |

#### VerifyRequest

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `challenge_id` | `string` | Yes | — | Min length: 32; Max length: 64; Pattern: `^[A-Za-z0-9_-]+$` |
| `code` | `string` | Yes | — | Min length: 6; Max length: 6; Secret; write-only |

FastAPI's emitted HTTPValidationError/ValidationError schema components are not
application entities. Canonical validation responses use ErrorResponse and FieldError
as specified in API-05.

### 3.8. Job completion messages

These Pydantic contracts are shared by all message transports. Reject unknown
fields, unsupported schema versions, null required values and invalid UUIDs.
`message_id` and `job_id` are canonical nonzero UUIDs. Asset IDs, ready status,
completion time and download URLs are assigned by the backend.

#### LibraryFileSource

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `storage` | `string` | Yes | — | Configured source alias; reserved library means the destination library |
| `path` | `string` | Yes | — | Relative object/file path under that source root; 1–1024 characters |

Source aliases resolve through storage adapters: for example `incoming` maps to a
local directory in dev or a bucket/prefix in AWS. The message never chooses a
provider driver or supplies credentials. Paths cannot be absolute, URLs, contain
backslashes, empty/dot/dot-dot components or control characters; path resolution
must remain within the configured root, including through local symlinks.

#### LibraryImportFile

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `id` | `string` | Yes | — | Asset-scoped file ID as in LibraryAssetFile |
| `format` | `AssetFormat` | Yes | — | ply or sog; source suffix need not determine the declared format |
| `size_bytes` | `integer` | Yes | — | Positive, at most 2 GiB |
| `sha256` | `string` | Yes | — | 64 hex digits, normalized to lowercase; verified against actual bytes |
| `source` | `LibraryFileSource` | Yes | — | Where to read the completed immutable file |

#### JobCompletionAsset

One result asset, without a producer-assigned asset/correlation ID. The backend
allocates its ID when the whole job completion is committed.

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `name` | `string` | Yes | — | Trimmed, nonblank, 1–200 characters |
| `tags` | `Array<string>` | No | `[]` | LIB-08 normalization and limits |
| `thumbnail_key` | `string \| null` | No | `null` | Separate existing-library thumbnail reference, LIB-09 |
| `primary_file_id` | `string` | Yes | — | Must identify exactly one entry in files |
| `files` | `Array<LibraryImportFile>` | Yes | — | Nonempty ordered list with unique asset-scoped IDs |

Model-file sources must resolve to distinct objects across the complete message;
thumbnail references must also be distinct and cannot refer to model files.
The thumbnail is not a model-file entry. The producer prepares it before completion;
thumbnail rendering and an external-thumbnail transfer API are outside the handler.
Initial transform defaults are the ordinary library defaults.

#### JobCompletionMessage

| Field | Type | Required | Default | Constraints / meaning |
| --- | --- | --- | --- | --- |
| `schema_version` | `2` | Yes | — | Exact integer version |
| `message_id` | `string (UUID)` | Yes | — | Transport request identity, not an asset or job-result identity |
| `job_id` | `string (UUID)` | Yes | — | Canonical nonzero UUID of a pre-existing job |
| `assets` | `Array<JobCompletionAsset>` | Yes | — | Nonempty complete result set for one successful job |

Example JSON accepted unchanged as a RabbitMQ message body or an SQS body:

```json
{
  "schema_version": 2,
  "message_id": "7f75cf76-c36f-41b6-ac4b-3983b9f35451",
  "job_id": "443f452a-cb09-4eb5-9087-9643d99c649a",
  "assets": [
    {
      "name": "Oak",
      "tags": ["tree"],
      "thumbnail_key": null,
      "primary_file_id": "sog",
      "files": [
        {
          "id": "sog", "format": "sog", "size_bytes": 2048,
          "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "source": {"storage": "library", "path": "oak.sog"}
        },
        {
          "id": "ply", "format": "ply", "size_bytes": 4096,
          "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "source": {"storage": "incoming", "path": "oak.ply"}
        }
      ]
    }
  ]
}
```

The example hashes/sizes are placeholders for real verified file contents. Version
1 standalone-asset descriptors are not job-completion messages and are rejected.
Queue delivery never implicitly creates an unknown job.

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
| 404 | `project_not_found` for a project; `job_not_found` for a job; `not_found` for other missing resources |
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
read.

## 8. Library and project clouds

**LIB-01. Upload.** Lifecycle: create upload → PUT bytes to `upload_url` → complete
→ ready. Creation accepts `name` (1–200 characters, nonblank after trimming),
`size_bytes`, `format` (`ply` by default; `sog` is also supported), and optional
thumbnail reference and tags as defined in LibraryUploadCreate. It creates a pending asset with a
server-generated `<id>.<format>` key and a single file entry with ID `main`,
which is also the primary file. The current declared-size
limit is `2,147,483,648` bytes (2 GiB); the size must be positive. Pending assets
are excluded from public ready-asset list/get operations and cannot become project
instances.

**LIB-02. Completion.** Complete checks file existence, exact size and container
signature: the first four bytes of PLY must be `ply\n` or `ply\r`; SOG must start
with `PK\x03\x04`. This validates the container signature, not the full decoded
format. An invalid file remains pending and returns `422`. Successful completion
publishes a ready asset; repeating complete on a ready asset returns the same resource.
If a thumbnail is referenced, its existence and thumbnail constraints in LIB-09
are also validated before publication. A failed check leaves the item pending.

**LIB-03. Storage.** Domain operations use a common LibraryStorage contract:
upload/download URLs, inspection/finalization, source resolution/streaming import
and staged deletion. Transfer and URL generation remain behind storage interfaces;
queue selection does not choose the storage provider. The adapter
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
changes; duplicate bulk IDs are deduplicated. They remove asset/file records, all model bytes,
owned thumbnail bytes and all associated cloud instances. A producing job and
its completed_at are retained; the deleted asset is removed from its relationship. Each affected project's
revision increments once per batch; other project resources remain and cloud order
is compacted. An unknown selected ID returns `404` without partial deletion. Already-missing bytes do not
prevent record deletion. Storage staging encloses SQL commit: bytes are restored
on failure; temporary backups are cleaned up after commit. If restoration fails,
backups remain for recovery. This is not a distributed transaction guaranteed to
survive every possible crash.

**LIB-05. Defaults.** Assets store finite Euler XYZ `default_rotation_deg`, positive
`default_scale` and finite `default_offset`. PATCH requires rotation and scale;
omitting offset preserves its previous value. Changing defaults affects **new**
cloud instances only. The file and existing instances remain unchanged.

### 8.1. Library identity, tags and thumbnails

Library metadata and job-result registration belong to the backend monolith.
Manual uploads and job results use the same asset/file model and record contracts.

**LIB-06. Asset identity and job ownership.** Every library item has one
server-generated ID used by resource URLs, file records and project-cloud foreign
keys. A generated result has a nullable job_id referencing its producing job;
manual uploads and ungrouped legacy data have job_id=null. Message IDs and file
variant IDs are separate scopes, not alternate library-item identities. External
producers never assign an asset ID. The job relationship is the authoritative
mapping from a completed operation to its assets.

Every LibraryAsset and LibraryUpload response includes job_id, tags and
thumbnail_url. The library does not retain a separate producer-ID reservation
ledger. Replays of generated results are handled at the job boundary (JOB-02).

**LIB-07. Manual upload creation and completion.** Each valid
POST /api/v1/library/uploads returns 201 LibraryUpload with a fresh pending asset,
a single primary main file and a non-null upload URL. Repeating the create request
creates another pending manual upload; it does not replay a job result or discover
an existing item by producer identity. Repeating complete on the same ready asset
returns its current resource without reopening or overwriting ready bytes.

Manual upload operations cannot populate or complete a job. Generated results
use the all-assets completion transaction in LIB-15 and JOB-02. Neither job IDs,
asset IDs nor thumbnail keys grant write permission.

**LIB-08. Tags.** Tags are metadata on the shared asset, not on a project cloud.
Use an array of strings, default `[]`; null, non-string elements and more than
20 input entries return `422 validation_error` before deduplication. For each tag,
reject ASCII control characters U+0000–U+001F and U+007F, normalize Unicode to NFC,
trim surrounding whitespace and collapse internal runs of Unicode whitespace to
one ordinary space. The normalized tag must contain 1–64 Unicode code points.
Reject blank/oversized tags rather than silently dropping or truncating them.
Deduplicate by Unicode casefold, preserving the first occurrence's spelling and
order. For example, `[" Tree ", "tree", "Rock"]` becomes `["Tree", "Rock"]`.
Persist exactly the normalized list; do not serialize it as a comma-separated
string. Tags are assigned at creation; the library API has no tag search, taxonomy
or post-creation metadata PATCH. The defaults PATCH changes only transforms.

**LIB-09. Thumbnail reference and serving.** Persist nullable thumbnail_key,
never a presigned URL, bucket URL or machine-absolute path. A thumbnail is an
already-produced raster object; rendering/conversion is a producer responsibility.

- New references use `thumbnails/<canonical-nonzero-UUID>.<extension>` with
  lowercase png, jpg, jpeg or webp. The UUID names a storage object, not a second
  asset identifier. Reject extra components, traversal, backslashes, percent
  encoding, URLs, absolute paths and malformed keys with 422 validation_error.
- The referenced object must exist inside the configured library storage root,
  be a regular file/object of at most 5 MiB and have the matching raster signature
  (PNG, JPEG or RIFF/WEBP). Local resolution remains within that thumbnail path,
  including through symlinks. Missing/invalid thumbnails prevent publication.
- Manual creation and job completion accept the same optional reference. A
  thumbnail belongs to one asset only: enforce unique non-null thumbnail_key
  and reject use by another asset or by several results in the same completion.
  Once ready, its bytes/reference are immutable. Deletion stages every model
  representation and the owned thumbnail, restoring them on database failure.
- Responses compute thumbnail_url through the configured LibraryStorage adapter.
  Local mode uses GET /api/v1/library/{asset_id}/thumbnail; S3 uses an expiring
  image GET URL under the configured prefix. Storage keys are not public URLs.
- Pending items and items without a thumbnail return thumbnail_url=null. Images
  follow the ordinary public ready-library read policy. Local serving returns
  404 for missing/pending/deleted assets or missing image bytes and sets the
  raster content type. Expired URLs are refreshed by rereading the asset; absent
  or unavailable images use the normal UI placeholder.

**LIB-10. Reads and client compatibility.** List/get by server asset ID retain
their ready-only behavior and ordering. Pending/missing/deleted assets return
404 not_found. Job results are discovered through GET /api/v1/jobs/{job_id},
which includes the related assets and their file/download metadata. No library
lookup by producer correlation ID is exposed.

Editor authentication applies to manual writes and job creation. Producers use
broker credentials/permissions: RabbitMQ access in QUEUE-03 or AWS IAM in QUEUE-04. Existing manual clients sending
name/size/format receive a fresh pending asset and can PUT/complete as before.
OpenAPI and generated clients agree with the fields and operation IDs. Library
list/details display tags and the thumbnail placeholder fallback; manual creation
can supply optional tags/reference metadata without requiring a thumbnail or job.
The UI does not ask users to type storage UUIDs/keys or internal job configuration.

**LIB-11. Migration and verification.** Upgrade populated databases and fresh
databases to the same record contract in STORE-04–05. Preserve asset IDs, object
keys/bytes, statuses, timestamps, transform defaults, cloud references/order and
project revisions. Pre-existing assets are ungrouped until explicitly associated
by a supported operation; migration does not invent producing jobs.

Verify manual upload compatibility, tags normalization/limits, thumbnails present,
absent/invalid/inaccessible and independently owned, all-file deletion rollback,
adapter URL generation and namespace/ownership checks. Check a populated Alembic
upgrade and repeated upgrade separately from fresh HTTP fixtures.

**LIB-12. Library boundaries and creation events.** File production, generation
scheduling, project attachment and browser event delivery are separate operations.
The completion handler receives all ready outputs for an existing job and publishes
the library records together with job completion (LIB-15, JOB-02).

If a creation-event mechanism is enabled, an asset event identifies the server
asset ID and producing job_id. Persist it with the successful publication and
deliver it only after commit. A replay must not emit new logical asset/job events.
Neither queue acknowledgement nor a ready asset promises client download/rendering.

### 8.2. Multiple files and job results

**LIB-13. File collection and primary representation.** One library item has one
or more independently downloadable model files and exactly one primary file.
Formats may repeat; file IDs, not formats, identify entries. Preserve message
order in `files`; `primary_file_id` explicitly selects the primary entry. This
does not create several library items or several project instances.

LibraryAsset and LibraryUpload retain their existing scalar `format`, `size_bytes`
and `download_url`, always mirroring the primary file. Pending downloads are null.
ProjectCloud also resolves its format/download URL from the current asset primary
file. Existing clients/manual uploads remain usable without selecting file variants.
Public asset reads expose every ready file via adapter-generated URLs. Local
`GET /api/v1/library/{asset_id}/files/{file_id}/content` serves that file only for
a ready asset; absent/deleted/pending resources return `404`. The existing content
route remains a primary-file alias and its URL shape is preserved for primary
downloads. S3 URLs target the corresponding private object.
Source locations never appear in public responses. The ready file collection,
primary choice and bytes are immutable; adding/replacing files requires a new item.
No new multi-file browser upload/editor is implied by the message import contract.

**LIB-14. Import sources and destination naming.** A job-completion message
contains all result assets, each with its complete file list, rather than a
pointer to another JSON manifest. Producers finish every file/thumbnail before
enqueueing the completion. The import handler
inside the monolith resolves each source through a provider-neutral storage
interface. `library` means the configured destination root/bucket prefix. Other
aliases identify explicitly configured read-only source roots; unconfigured aliases
are invalid. An alias may point to local storage or S3 without changing the JSON
or handler. A local source is a path on the backend host/shared volume, not a path
on the HTTP caller's machine. Sending JSON does not upload model bytes.

If resolution identifies an object already under the destination library root,
inspect and adopt its existing key without copying or renaming the object. This
also applies when a different alias resolves to the same physical root/key. It
must be unowned, in the ready model namespace (not `_uploads/`, staging or
`thumbnails/`) and not referenced by another asset, primary alias or file entry.
Distinct file entries cannot resolve to the same object. A filename suffix must
match the declared format for adopted objects so existing serving contracts hold.

Otherwise copy/stream the file into library storage under a new server-generated
`<UUIDv4>.<format>` key, independent of the original basename and asset/file IDs.
Do not overwrite a destination or remove/rename the producer's original. Transfers
are bounded streaming operations, not whole-file reads into memory. Use staging
and verify the exact byte count, SHA-256 and LIB-02 signature before finalization.
S3 ETags are not a replacement for SHA-256. Thumbnail checks remain LIB-09.
Apply the current 2 GiB limit per model file; primary `size_bytes` is not an
aggregate quota. No global file-count or total-library quota is added here.

**LIB-15. Atomic result publication and recovery.** Resolve the target job before
reading/copying result files. Unknown jobs fail without creating a job or assets;
already completed jobs follow the no-op policy in JOB-02. For an unfinished job,
validate every file/thumbnail of every result before publication.

In one transaction create all ready assets with their file rows, producing job_id
and original job_position, then set JobRecord.completed_at. No intermediate
pending assets or partially completed job are publicly visible. Job result
publication neither attaches clouds to projects nor changes project revisions.
Do not hold a database writer transaction while copying gigabytes.

Concurrent deliveries may stage independently. A database compare-and-set/locked
completion check selects one complete result set; other deliveries return the
committed job and clean only their own unused copies. Different jobs cannot
adopt an object or thumbnail already owned by another asset.

Validation or commit failure leaves completed_at=null and no new assets/results.
Keep adopted library objects and external producer sources unchanged. Remove
only newly copied objects proven to belong to the failed attempt; never remove
an unrelated file after a destination UUID collision. Track interrupted attempts
durably in storage, and check committed ownership before recovery cleanup.

After commit, all model files and owned thumbnails enter normal library deletion,
including adopted objects; external originals remain producer-owned. Deletion
restores all staged bytes on SQL failure. It removes that asset from the job's
surviving results without changing job completion or recreating results on replay.

**LIB-16. Completion validation and failure policy.** A completion is an entire
successful result set, not an append/update command. Model-file hashes are verified
before the first successful publication. The minimal job has no producer asset
key, separate result reservation or result-fingerprint ledger. Once completed,
the job's first committed result remains authoritative as defined in JOB-02.

Malformed/obsolete message schemas, unknown job IDs, invalid namespaces/formats/
hashes, already-owned objects and proven missing sources are terminal. Unknown
jobs use job_not_found; missing sources library_import_source_missing; invalid
file contents library_import_invalid_file; forbidden/unconfigured sources
library_import_invalid_source; occupied objects/thumbnails
library_import_object_conflict. Temporary storage/DB/queue outages retry with
bounded backoff; exhausted attempts use library_import_unavailable. Inability to
inspect a source is not evidence that it is absent. A failed transport attempt
does not mark the minimal job completed; a corrected delivery can target it again.

### 8.3. Message queue boundary and adapters

**QUEUE-01. Contract and composition.** Define an asynchronous MessageQueue
contract in services/message_queue.py, independent of FastAPI, database transport
records, boto3, aio-pika, SQS and RabbitMQ. Each delivery contains validated
JobCompletionMessage, an opaque receipt and a positive attempt count. Provide
receive (bounded wait), hold (an async context managing delivery ownership), ack,
retry (delay), reject (durably quarantine a failure) and aclose. Receipt handles
and message objects never expose provider SDK types to core business services.
Acknowledgement takes only the receipt; job results are discovered through jobs.

The consumer enters hold around result processing/settlement. Providers own
connection state, delivery ownership and all renewal tasks inside that context;
core has no lease timers, visibility timeout or provider-name branches. SQS renews
visibility while held and stops renewal before changing delivery/ack state.
RabbitMQ retains an unacknowledged AMQP delivery. Cancellation/failure leaves an
unsettled delivery recoverable; a failed ownership renewal cancels processing.
Malformed/oversized bodies are quarantined before invoking domain logic.

The configuration decorator injects RabbitMQ from dev/ or SQS from aws/ based on
independent configuration. The common consumer runs inside application lifespan,
not a separate process calling HTTP. Stop/await it before closing the injected
queue and repository. Disabled queue mode creates no queue/source clients and
ordinary HTTP works during broker outages. There is no HTTP producer/status API,
SQLite queue simulation or /api/v1/dev namespace in any environment.

**QUEUE-02. Delivery semantics.** Assume at-least-once delivery without ordering.
Ack only after the all-assets/job commit or a completed-job no-op. A crash or ack
loss redelivers safely through JOB-02; transport message IDs are diagnostics, not
asset identities or a separate body-deduplication registry. Reusing a message ID
does not grant an append/update operation. Correcting an unfinished job can use
a new message ID; a completed job still keeps its first successful result.

Temporary failures use delays 1, 2, 4, 8, 16, 32, 60 seconds (capped at 60), up
to the configured attempt limit (default 5). Retry delays do not hold up unrelated
messages. Terminal/exhausted failures go durably to the failure queue before the
original is acknowledged. If forwarding or its confirmation fails, retain/requeue
the original; ambiguous confirms may duplicate deliveries, never justify dropping
them. Log message/job IDs, attempt and sanitized error code without credentials,
receipts or file contents. Read success through GET /api/v1/jobs/{job_id}; inspect
failures through the broker failure queue and logs, not an application debug API.

**QUEUE-03. Development RabbitMQ transport.** Select message_queue=rabbitmq and
inject RabbitMQMessageQueue from dev/message_queue.py. The adapter uses aio-pika
and a real AMQP subscription with manual acknowledgements and prefetch_count=1.
Connect lazily so merely constructing/exporting the application neither needs a
running broker nor performs broker I/O. Reconnect after outages and close all
AMQP resources on application shutdown; stale channel deliveries cannot be
acknowledged on a replacement channel.

Declare durable quorum input queue (default camera-path.job-completions) and
failure queue <input>.failed. Disable the input's automatic delivery limit so the
application controls terminal/exhausted handling. Retry through durable quorum
queues <input>.retry.<seconds> for the seven delays in QUEUE-02, each with its
fixed message TTL and dead-letter route back to the input. Configure retry queues
for at-least-once dead lettering with reject-publish overflow. Publish retries and
failures as persistent messages with mandatory routing and publisher confirms
before acking the original. Keep application attempt number in the private
camera-path-attempt header; combine it with RabbitMQ's redelivery count so process
crashes do not reset attempts. Failure messages retain original bytes and an
error_code header. Provider retry/diagnostic headers are not fields of the JSON
contract and do not leak into jobs/assets.

The body is the full UTF-8 completion JSON, up to 256 KiB. There is no manifest URL
wrapper and no HTTP authentication/JWT involved in publication. Use the broker's
credentials. Terminal malformed/version-1 messages go to the failure queue with
validation_error, without creating jobs/assets. Repeated deliveries use the same
common completion service and transaction/idempotence rules as SQS.

Supply a local Docker Compose broker with AMQP and management ports bound to
loopback and a persistent development volume. An operator can publish an existing
completion.json using rabbitmqadmin (management HTTP API of the broker) or an AMQP
client. The backend consumes via AMQP; publishing success confirms broker routing,
not job completion. Autonomous integration tests own a disposable real broker,
isolated queues/files/database and test credentials, and remove their own resources.

**QUEUE-04. AWS SQS transport.** Poll a configured SQS Standard queue. Each
MessageBody is exactly the same JobCompletionMessage JSON as RabbitMQ; SQS
attributes/receipts are adapter details. S3 notifications and manifest-pointer
envelopes are not accepted. Producers send the complete descriptor after files
are complete. No SNS topic or S3 notification rule is required.

Use long polling and explicit DeleteMessage after commit/no-op. The SQS adapter
owns visibility renewal during hold; stop/await renewal before changing visibility
for retry or deleting the message. On renewal failure, cancel in-flight domain
processing and leave the delivery unacknowledged. Forward terminal/exhausted
messages to the configured failure queue with sanitized error attributes before
deleting the original. Forwarding/ack loss may duplicate messages, not lose them.
AWS uses the standard credential chain/EC2 role and scoped IAM permissions, not
editor JWTs or a public import endpoint. Provisioning/deployment and live AWS
acceptance are separate operational work.

### 8.4. Jobs and result lifecycle

**JOB-01. Minimal job resource.** POST /api/v1/jobs (createJob), with no request
body, requires the editor and returns 201 Job with a generated UUID, completed_at=null
and assets=[]. This reserves an empty job only; it does not start a generator,
publish a start event, claim work or establish a scheduler/progress API. Each
creation call makes a new job. GET /api/v1/jobs/{job_id} (getJob) is public under
the existing shared-data policy and returns 200 Job; invalid UUIDs return 422
validation_error, unknown IDs 404 job_not_found. Neither operation uses a project
ETag/If-Match. There is no job update/delete/list endpoint in this minimal contract.
Creation/read remain available with message consumption disabled.

**JOB-02. Completion identity and replay.** A pre-existing job accepts one whole
successful completion. The first transaction changing completed_at from null
publishes its entire result set. The server assigns the UTC timestamp and asset
IDs; producers cannot choose them. The job ID itself supplies durable completion
identity, regardless of message ID or queue redelivery.

For a well-formed message targeting an already-completed job, acknowledge success
without accessing producer sources, creating assets, changing metadata/defaults,
resetting completed_at or appending/replacing results. This applies even when a
later message ID/payload differs: first successful completion wins. A deliberate
new computation/result set uses a new job. No result fingerprint or comparison
against potentially deleted asset rows is needed for this minimal policy.

Concurrent completion attempts select one winner; all others observe its job
state. A crash after commit before ack is an ordinary successful replay. A failed
attempt before commit leaves the empty job available for a corrected completion.
The queue must never create an unknown job from a completion message.

**JOB-03. Relationships and result reads.** JobRecord.assets is
Mapped[list[LibraryAssetRecord]] through LibraryAssetRecord.job_id, ordered by
job_position. A job may produce several assets, each with several files. This is
a persisted foreign-key relationship, not a stored JSON list, a scan of the global
library or a second correlation-ID namespace. Ordinary manual assets have both
job_id and job_position null.

GET job exposes current surviving results and refreshes their storage URLs. The
frontend can poll that resource and use assets as soon as completed_at is non-null;
queue submission itself is not a synchronous result response. Removing library
assets may leave a completed job with assets=[]. Its completed_at remains set,
and later completion messages cannot resurrect deleted assets. Reading state and
registering results does not itself add project clouds or browser event delivery.

**CLOUD-01.** A ready asset can be attached multiple times to one or more projects.
Each operation creates a separate instance ID, copies current asset defaults,
accepts finite translation, sets visible=true and appends to the ordered list.
It does not copy the file. Instance deletion is separate from asset deletion.
Project reset/delete removes instances while retaining the shared library.

**CLOUD-02.** Instance PATCH changes `position` and/or `visible`; an empty patch is
rejected. Position is an index in `0..count−1`; reordering preserves a unique,
contiguous order. Persisted rotation/scale/offset are returned but cannot be edited
through the current cloud PATCH. Applying transforms in the renderer is outside
the backend boundary.

## 9. Authentication and profile

**AUTH-01.** Public GET operations read shared data; GET /auth/session requires
Bearer authentication. Business writes, job creation, local upload, profile update
and logout require an editor session. Login/verify/resend require no JWT.
External job completions use broker credentials rather than HTTP authentication.
The single
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
internally. The current chat stream has no event IDs/replay. A client disconnect
alone guarantees neither rollback of persisted data nor cancellation of the provider request.

## 11. Persistence, configuration and operations

**STORE-01.** The main store is SQLite through async SQLAlchemy; schema migrations
use Alembic, with upgrade compatibility defined in LIB-11 and STORE-04. State is
normalized into typed columns; numeric vectors are not opaque JSON blobs. Foreign
keys are enabled. A Project aggregate is assembled for compatibility; full-snapshot
history with undo/redo is no longer the active persistence model.

| Group | Tables |
| --- | --- |
| Project / scene | `projects`, `anchors`, `scene_points`, `trajectory_segments`, `segment_anchors` |
| Controls | `motion_profiles`, `speed_keyframes`, `camera_tracks`, `aim_keyframes`, `orientation_keyframes`, `depth_of_field_keyframes`, `lidar_keyframes` |
| Library / jobs | `library_assets`, `library_asset_files`, `jobs`, `project_clouds` |
| Chat / profile | `chat_messages`, `user_settings` |
| Auth | `editors`, `editor_sessions`, `auth_challenges`, `auth_rate_limits` |

**STORE-02.** An operation changes its target resource, preserves unrelated rows
and references, retains ordering and checks the revision in the same transaction.
Reads do not create missing domain records. Migrations preserve IDs, references,
files and existing preferences. A default change must not overwrite an explicitly
persisted user choice. Startup `create_all` for missing tables does not replace
upgrading an existing schema.

### 11.1. Record conventions and supporting types

**STORE-03. Record catalogue.** The following catalogue complements the Pydantic
model catalogue in section 3. A model describes validated, serializable service
data; a record describes persisted columns and their database constraints. A model
field/default must not be assumed to create a database column/default or CHECK.

- `Base` is the SQLAlchemy `DeclarativeBase` and owns `Base.metadata`; it is not
  itself a table. Domain records are mapped in
  [persistence/records.py](src/camera_path/persistence/records.py). Transport state lives in RabbitMQ/SQS, with no adapter-owned SQL queue records.
- `Vector3` is a frozen `(x, y, z)` dataclass used by SQLAlchemy composites. It has
  no table or JSON column. `as_tuple()` returns the coordinates in that order.
- `ProjectChildRecord` is an unmapped mixin adding non-null `project_id`, its
  project FK with `ON DELETE CASCADE` and a nonunique project index.
  `ProjectScopedKeyframeRecord` is another unmapped mixin with the same column/FK/
  index, but `project_id` also participates in the concrete record's primary key.
  The catalogue expands these inherited columns instead of omitting them.
- `ORM insert default` means SQLAlchemy's Python-side `default=` when an ORM
  insert omits a value. `SQL default` is the database `DEFAULT` installed by schema
  creation/upgrades, also applicable to direct SQL inserts. `—` means
  no explicit default of that kind, not an empty string or zero. An omitted nullable
  column may become NULL; a required column needs a supplied/defaulted value.
- Historical migrations retain SQL defaults `'0'`/`'1'` for library transform
  defaults and project-cloud translation/rotation/scale/offset. The ORM has Python
  numeric defaults for those columns but does not declare their `server_default`.
  Explicit ORM server defaults cover the three settings preferences and the
  empty tags array on library assets.
  Therefore `Base.metadata.create_all()` alone does not reproduce every historical
  SQL default; migrations remain the schema-creation/upgrade contract.
- For the four project-scoped keyframe tables, ORM primary-key order is
  `(id, project_id)` while the migrated schema uses `(project_id, id)`. Both identify
  the same row set and allow an ID to recur in another project. Record both orders
  rather than silently changing the existing schema as part of documentation.
- SQL types below are the declared SQLite types. `DATETIME` corresponds to
  SQLAlchemy `DateTime(timezone=True)`, not a native SQLite timezone type; the
  writer supplies timestamps. Authentication times are integer Unix
  seconds. IDs are supplied by application code; there are no database UUID or
  auto-increment generators in these records.
- `alembic_version` is migration bookkeeping, not an application record. It has
  `version_num VARCHAR(32) NOT NULL`, primary key `alembic_version_pkc`, and stores
  the current Alembic revision. Removed snapshot/history tables are not part of
  this schema. Jobs are minimal completion/resource records, not a worker queue or outbox.

### 11.2. Persisted enums

`enum_column` stores each `StrEnum.value`, not the uppercase Python member name,
as a non-native `VARCHAR` with a named CHECK. String validation is enabled in the
ORM. The concrete CHECK names and nullable columns are listed per record below.
These values and spelling must survive recreation/migration unchanged.

| Enum | Persisted values | Declared SQL type |
| --- | --- | --- |
| `SegmentKind` | `spline`, `spiral` | `VARCHAR(6)` |
| `SpiralDirection` | `cw`, `ccw` | `VARCHAR(3)` |
| `CurveLaw` | `linear`, `smoothstep` | `VARCHAR(10)` |
| `AimKind` | `follow_path`, `look_at_point` | `VARCHAR(13)` |
| `AimDirection` | `forward`, `backward` | `VARCHAR(8)` |
| `Interpolation` | `hold`, `linear`, `smoothstep` | `VARCHAR(10)` |
| `FocusKind` | `center_weighted_9`, `scene_point` | `VARCHAR(17)` |
| `LiftAxis` | `world_up`, `surface_normal` | `VARCHAR(14)` |
| `LibraryAssetStatus` | `pending`, `ready` | `VARCHAR(7)` |
| `ChatRole` | `user`, `assistant` | `VARCHAR(9)` |


### 11.3. Record catalogue

The following records define the persistence contract. Every inherited/composite
column is expanded here. ORM insert defaults and database SQL defaults are listed
separately. Constraints below enumerate explicit PK/FK/UNIQUE/CHECK/index
definitions; implicit indexes created for PK/UNIQUE are not listed again.
Schema upgrade and identifier-lifecycle rules are in section 11.5.

#### UserSettingsRecord — `user_settings`

Shared application profile, independent of projects. The configured user key is not an editor-table foreign key.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `gaussian_dpr` | `TEXT` | No | — | `'1x'` | Stored DPR preference; allowed service values are 1x/system, without a database CHECK. |
| `user_id` | `TEXT` | No | — | — | Configured shared profile key, not a foreign key. |
| `webgpu_tile_renderer` | `BOOLEAN` | No | `False` | `0` | Renderer preference; false selects the current Spark default. |
| `show_grid` | `BOOLEAN` | No | `True` | `1` | Grid visibility preference. |

- Primary key: `user_id`.

#### ProjectRecord — `projects`

Project identity, display name and optimistic-concurrency revision; scene data lives in child tables.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `name` | `TEXT` | No | — | — | Display name. |
| `revision` | `INTEGER` | No | `0` | — | Compare-and-swap revision for project writes. |

- Primary key: `id`.

#### LibraryAssetRecord — `library_assets`

Shared item metadata and transform defaults, including pending uploads. Binary
model content lives in storage, not in this row. The existing format/object_key/
size_bytes columns mirror the primary LibraryAssetFileRecord for compatibility;
services maintain this invariant transactionally, not as independent writable data.
The nullable job foreign key associates generated results with their producing
job; manual and ungrouped legacy assets have no producing job.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `job_id` | `TEXT` | Yes | — | — | Producing job; null for manual/ungrouped assets. |
| `job_position` | `INTEGER` | Yes | — | — | Original zero-based result position within that job; null for manual assets. |
| `name` | `TEXT` | No | — | — | Display name. |
| `format` | `TEXT` | No | — | — | Plain text ply/sog validated by the service; not a database enum. |
| `object_key` | `TEXT` | No | — | — | Unique relative storage key, never a temporary URL. |
| `size_bytes` | `BIGINT` | No | — | — | Declared model byte count. |
| `status` | `VARCHAR(7)` / `LibraryAssetStatus` | No | — | — | Pending or published/ready lifecycle. |
| `created_at` | `DATETIME` | No | — | — | Application-supplied creation time; no SQL clock default. |
| `thumbnail_key` | `TEXT` | Yes | — | — | Owned relative thumbnail object key; null when absent, never a URL. |
| `tags` | `JSON` | No | `list` | `'[]'` | Normalized string array; a fresh list is created for each ORM insert. |
| `default_rotation_x_deg` | `FLOAT` | No | `0.0` | `'0'` | Default Euler rotation about local x, degrees; copied to new instances. |
| `default_rotation_y_deg` | `FLOAT` | No | `0.0` | `'0'` | Default Euler rotation about local y, degrees; copied to new instances. |
| `default_rotation_z_deg` | `FLOAT` | No | `0.0` | `'0'` | Default Euler rotation about local z, degrees; copied to new instances. |
| `default_scale` | `FLOAT` | No | `1.0` | `'1'` | Uniform scale copied into newly created instances. |
| `default_offset_x` | `FLOAT` | No | `0.0` | `'0'` | Default model-space offset component x; copied to new instances. |
| `default_offset_y` | `FLOAT` | No | `0.0` | `'0'` | Default model-space offset component y; copied to new instances. |
| `default_offset_z` | `FLOAT` | No | `0.0` | `'0'` | Default model-space offset component z; copied to new instances. |

- Primary key: `id`.
- UNIQUE (unnamed): `(object_key)`.
- UNIQUE `uq_library_assets_job_position`: `(job_id, job_position)`.
- UNIQUE `uq_library_assets_thumbnail_key`: `(thumbnail_key)`; multiple nulls allowed.
- Index `ix_library_assets_job_id`: `(job_id)`.
- FK `fk_library_assets_job_id`: job_id → jobs(id), ON DELETE RESTRICT.
- CHECK `ck_library_assets_job_position`: (job_id IS NULL AND job_position IS NULL) OR
  (job_id IS NOT NULL AND job_position IS NOT NULL AND job_position >= 0).
- A generated asset is ready and attached to a completed job at publication; this
  cross-table invariant is enforced by the completion transaction, not a CHECK.
- CHECK `ck_library_assets_status`: `status IN ('pending', 'ready')`.

#### LibraryAssetFileRecord — `library_asset_files`

Ordered representation owned by a library asset. Relative keys refer only to
library storage, never to external producer sources.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `asset_id` | `TEXT` | No | — | — | Owning library asset. |
| `id` | `TEXT` | No | — | — | Asset-scoped file ID; manual/legacy single file uses main. |
| `position` | `INTEGER` | No | — | — | Zero-based order within the asset. |
| `is_primary` | `BOOLEAN` | No | `False` | `0` | Exactly one per asset, enforced additionally by service validation. |
| `format` | `TEXT` | No | — | — | Service-validated ply/sog. |
| `object_key` | `TEXT` | No | — | — | Owned, unique relative library key. |
| `size_bytes` | `BIGINT` | No | — | — | Declared/verified size. |
| `sha256` | `TEXT` | Yes | — | — | Verified lowercase digest; null for unhashed legacy/manual data. |

- Primary key: `(asset_id, id)`.
- FK `fk_library_asset_files_asset`: asset_id → library_assets(id), ON DELETE CASCADE.
- UNIQUE `uq_library_asset_files_object_key`: `(object_key)`.
- UNIQUE `uq_library_asset_files_position`: `(asset_id, position)`.
- Partial UNIQUE index `uq_library_asset_files_primary`: `(asset_id)` WHERE is_primary = 1.
- Exactly one primary, contiguous positions, valid IDs/size/hash, primary-column
  mirroring and non-sharing with thumbnail keys are transactional service invariants.
  A pending/manual primary may mirror the owner's object_key but not another asset's.

#### JobRecord — `jobs`

Minimal persisted job state, created before results exist. The assets relationship
is supplied by child foreign keys and is not a column or separate ID ledger.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Server-generated job UUID. |
| `completed_at` | `DATETIME` | Yes | — | — | Null while awaiting results; immutable UTC completion time afterwards. |

- Primary key: id. No additional scalar columns, queue/worker metadata or indexes.
- Relationship: assets: Mapped[list[LibraryAssetRecord]], back_populates=job,
  through library_assets.job_id and ordered by job_position. The reverse job
  relationship is nullable. Neither relationship is a serialized database column.
- No deletion cascade removes library results when a job is referenced. The
  minimal API does not delete jobs; their completed state remains after assets
  are individually deleted from the library.

#### ProjectCloudRecord — `project_clouds`

One independent instance of a ready library asset in a project; transforms are copied from current asset defaults when the instance is created.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `project_id` | `TEXT` | No | — | — | Owning project. |
| `library_asset_id` | `TEXT` | No | — | — | Referenced shared library asset; deletion is restricted until instances are removed. |
| `position` | `INTEGER` | No | — | — | Zero-based order within the owning collection. |
| `visible` | `BOOLEAN` | No | `True` | — | Instance visibility. |
| `translation_x` | `FLOAT` | No | `0.0` | `'0'` | World-space translation component x. |
| `translation_y` | `FLOAT` | No | `0.0` | `'0'` | World-space translation component y. |
| `translation_z` | `FLOAT` | No | `0.0` | `'0'` | World-space translation component z. |
| `rotation_x_deg` | `FLOAT` | No | `0.0` | `'0'` | Instance Euler rotation about local x, degrees. |
| `rotation_y_deg` | `FLOAT` | No | `0.0` | `'0'` | Instance Euler rotation about local y, degrees. |
| `rotation_z_deg` | `FLOAT` | No | `0.0` | `'0'` | Instance Euler rotation about local z, degrees. |
| `scale` | `FLOAT` | No | `1.0` | `'1'` | Uniform instance scale. |
| `offset_x` | `FLOAT` | No | `0.0` | `'0'` | Instance model-space offset component x. |
| `offset_y` | `FLOAT` | No | `0.0` | `'0'` | Instance model-space offset component y. |
| `offset_z` | `FLOAT` | No | `0.0` | `'0'` | Instance model-space offset component z. |

- Primary key: `id`.
- Foreign key: `(library_asset_id) → library_assets(id)`; ON DELETE RESTRICT.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- UNIQUE `uq_project_cloud_position`: `(project_id, position)`.
- Index `ix_project_clouds_library_asset_id`: `(library_asset_id)`.
- Index `ix_project_clouds_project_id`: `(project_id)`.

#### AnchorRecord — `anchors`

An authoring anchor. The surface vectors are typed scalar columns exposed as Vector3 composites, not JSON payloads.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `label` | `TEXT` | No | — | — | Display label. |
| `surface_position_x` | `FLOAT` | No | — | — | Source surface position component x. |
| `surface_position_y` | `FLOAT` | No | — | — | Source surface position component y. |
| `surface_position_z` | `FLOAT` | No | — | — | Source surface position component z. |
| `surface_normal_x` | `FLOAT` | No | — | — | Source surface normal component x. |
| `surface_normal_y` | `FLOAT` | No | — | — | Source surface normal component y. |
| `surface_normal_z` | `FLOAT` | No | — | — | Source surface normal component z. |
| `lift` | `FLOAT` | No | — | — | Lift distance from the source surface. |
| `lift_axis` | `VARCHAR(14)` / `LiftAxis` | No | — | — | World-up or surface-normal lift mode. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `id`.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- Index `ix_anchors_project_id`: `(project_id)`.
- CHECK `ck_anchors_lift_axis`: `lift_axis IN ('world_up', 'surface_normal')`.
- Composite `surface_position: Vector3` maps columns `(surface_position_x, surface_position_y, surface_position_z)` in that order.
- Composite `surface_normal: Vector3` maps columns `(surface_normal_x, surface_normal_y, surface_normal_z)` in that order.

#### ScenePointRecord — `scene_points`

A named project-space target for aim and focus references. The redundant unique (project_id, id) key is the target of scoped composite foreign keys.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `label` | `TEXT` | No | — | — | Display label. |
| `position_x` | `FLOAT` | No | — | — | Scene-point position component x. |
| `position_y` | `FLOAT` | No | — | — | Scene-point position component y. |
| `position_z` | `FLOAT` | No | — | — | Scene-point position component z. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `id`.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- UNIQUE `uq_scene_points_project_id_id`: `(project_id, id)`.
- Index `ix_scene_points_project_id`: `(project_id)`.
- Composite `position: Vector3` maps columns `(position_x, position_y, position_z)` in that order.

#### TrajectorySegmentRecord — `trajectory_segments`

An ordered spline or spiral segment. The discriminator selects which scalar fields are present; anchor ordering is stored in segment_anchors.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `position` | `INTEGER` | No | — | — | Zero-based order within the owning collection. |
| `kind` | `VARCHAR(6)` / `SegmentKind` | No | — | — | Spline/spiral discriminator. |
| `tension` | `FLOAT` | Yes | — | — | Present only for spline. |
| `turns` | `FLOAT` | Yes | — | — | Present only for spiral. |
| `direction` | `VARCHAR(3)` / `SpiralDirection` | Yes | — | — | Present only for spiral. |
| `radial_law` | `VARCHAR(10)` / `CurveLaw` | Yes | — | — | Present only for spiral. |
| `axial_law` | `VARCHAR(10)` / `CurveLaw` | Yes | — | — | Present only for spiral. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `id`.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- UNIQUE `uq_trajectory_segments_position`: `(project_id, position)`.
- Index `ix_trajectory_segments_project_id`: `(project_id)`.
- CHECK `ck_segment_fields`: `(kind = 'spline' AND tension IS NOT NULL AND turns IS NULL AND direction IS NULL AND radial_law IS NULL AND axial_law IS NULL) OR (kind = 'spiral' AND tension IS NULL AND turns IS NOT NULL AND direction IS NOT NULL AND radial_law IS NOT NULL AND axial_law IS NOT NULL)`.
- CHECK `ck_trajectory_segments_axial_law`: `axial_law IN ('linear', 'smoothstep')`.
- CHECK `ck_trajectory_segments_direction`: `direction IN ('cw', 'ccw')`.
- CHECK `ck_trajectory_segments_kind`: `kind IN ('spline', 'spiral')`.
- CHECK `ck_trajectory_segments_radial_law`: `radial_law IN ('linear', 'smoothstep')`.
- ORM relationship `anchors → SegmentAnchorRecord[]`: `cascade=all, delete-orphan`, `passive_deletes=True`; repository reads order entries by their stored position.

#### SegmentAnchorRecord — `segment_anchors`

Ordered membership of anchors in a trajectory segment. An anchor can be referenced by multiple segments; position belongs to the segment, not the project.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `segment_id` | `TEXT` | No | — | — | Owning trajectory segment. |
| `position` | `INTEGER` | No | — | — | Zero-based order within the owning collection. |
| `anchor_id` | `TEXT` | No | — | — | Referenced anchor; deletion is restricted while referenced. |

- Primary key: `segment_id, position`.
- Foreign key: `(anchor_id) → anchors(id)`; ON DELETE RESTRICT.
- Foreign key: `(segment_id) → trajectory_segments(id)`; ON DELETE CASCADE.
- Index `ix_segment_anchors_anchor_id`: `(anchor_id)`.

#### MotionProfileRecord — `motion_profiles`

One motion-profile singleton per project. Speed keyframes are separate records.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `project_id` | `TEXT` | No | — | — | Owning project. |
| `default_speed` | `FLOAT` | No | — | — | Default path speed. |

- Primary key: `project_id`.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.

#### SpeedKeyframeRecord — `speed_keyframes`

A speed control point scoped to its project. The same keyframe ID can exist in another project.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `path_position` | `FLOAT` | No | — | — | Normalized whole-path arc-length position, not time. |
| `speed` | `FLOAT` | No | — | — | Speed at this control point. |
| `interpolation_to_next` | `VARCHAR(10)` / `Interpolation` | No | — | — | Interpolation for the outgoing interval. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `project_id, id`.
- ORM metadata declares primary-key order `id, project_id`; the migrated database order above differs, with the same key membership/uniqueness.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- Index `ix_speed_keyframes_project_id`: `(project_id)`.
- CHECK `ck_speed_keyframes_interpolation_to_next`: `interpolation_to_next IN ('hold', 'linear', 'smoothstep')`.

#### CameraTrackRecord — `camera_tracks`

One camera-track singleton per project: default aim, world-up vector and default Euler orientation. It does not contain the keyframe rows.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `project_id` | `TEXT` | No | — | — | Owning project. |
| `default_aim_kind` | `VARCHAR(13)` / `AimKind` | No | — | — | Default aim discriminator. |
| `default_aim_direction` | `VARCHAR(8)` / `AimDirection` | Yes | — | — | Required for follow_path; null for look_at_point. |
| `default_aim_scene_point_id` | `TEXT` | Yes | — | — | Required for look_at_point; null for follow_path. |
| `world_up_x` | `FLOAT` | No | — | — | Camera-track world-up vector component x. |
| `world_up_y` | `FLOAT` | No | — | — | Camera-track world-up vector component y. |
| `world_up_z` | `FLOAT` | No | — | — | Camera-track world-up vector component z. |
| `default_orientation_yaw_deg` | `FLOAT` | No | — | — | Default Euler orientation component yaw, degrees. |
| `default_orientation_pitch_deg` | `FLOAT` | No | — | — | Default Euler orientation component pitch, degrees. |
| `default_orientation_roll_deg` | `FLOAT` | No | — | — | Default Euler orientation component roll, degrees. |

- Primary key: `project_id`.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- Foreign key `fk_camera_track_scene_point`: `(project_id, default_aim_scene_point_id) → scene_points(project_id, id)`; no explicit ON DELETE (SQLite NO ACTION); DEFERRABLE INITIALLY DEFERRED.
- CHECK `ck_camera_track_aim`: `(default_aim_kind = 'follow_path' AND default_aim_direction IS NOT NULL AND default_aim_scene_point_id IS NULL) OR (default_aim_kind = 'look_at_point' AND default_aim_direction IS NULL AND default_aim_scene_point_id IS NOT NULL)`.
- CHECK `ck_camera_tracks_default_aim_direction`: `default_aim_direction IN ('forward', 'backward')`.
- CHECK `ck_camera_tracks_default_aim_kind`: `default_aim_kind IN ('follow_path', 'look_at_point')`.
- Composite `world_up: Vector3` maps columns `(world_up_x, world_up_y, world_up_z)` in that order.
- `get_default_aim`/`set_default_aim` convert the discriminator columns to/from service aim models and clear inactive fields; `get_default_orientation`/`set_default_orientation` map the three Euler columns.

#### AimKeyframeRecord — `aim_keyframes`

A project-scoped aim keyframe using normalized discriminator/direction/reference columns rather than serialized aim JSON.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `path_position` | `FLOAT` | No | — | — | Normalized whole-path arc-length position, not time. |
| `aim_kind` | `VARCHAR(13)` / `AimKind` | No | — | — | Aim discriminator. |
| `aim_direction` | `VARCHAR(8)` / `AimDirection` | Yes | — | — | Required for follow_path; null for look_at_point. |
| `aim_scene_point_id` | `TEXT` | Yes | — | — | Required for look_at_point; null for follow_path. |
| `interpolation_to_next` | `VARCHAR(10)` / `Interpolation` | No | — | — | Interpolation for the outgoing interval. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `project_id, id`.
- ORM metadata declares primary-key order `id, project_id`; the migrated database order above differs, with the same key membership/uniqueness.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- Foreign key `fk_aim_key_scene_point`: `(project_id, aim_scene_point_id) → scene_points(project_id, id)`; no explicit ON DELETE (SQLite NO ACTION); DEFERRABLE INITIALLY DEFERRED.
- Index `ix_aim_keyframes_project_id`: `(project_id)`.
- CHECK `ck_aim_key_aim`: `(aim_kind = 'follow_path' AND aim_direction IS NOT NULL AND aim_scene_point_id IS NULL) OR (aim_kind = 'look_at_point' AND aim_direction IS NULL AND aim_scene_point_id IS NOT NULL)`.
- CHECK `ck_aim_keyframes_aim_direction`: `aim_direction IN ('forward', 'backward')`.
- CHECK `ck_aim_keyframes_aim_kind`: `aim_kind IN ('follow_path', 'look_at_point')`.
- CHECK `ck_aim_keyframes_interpolation_to_next`: `interpolation_to_next IN ('hold', 'linear', 'smoothstep')`.
- `get_aim`/`set_aim` map the service aim union and keep the inactive direction/reference column null.

#### OrientationKeyframeRecord — `orientation_keyframes`

A project-scoped Euler XYZ orientation keyframe, with angles stored in degrees.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `path_position` | `FLOAT` | No | — | — | Normalized whole-path arc-length position, not time. |
| `yaw_deg` | `FLOAT` | No | — | — | Euler yaw, degrees. |
| `pitch_deg` | `FLOAT` | No | — | — | Euler pitch, degrees. |
| `roll_deg` | `FLOAT` | No | — | — | Euler roll, degrees. |
| `interpolation_to_next` | `VARCHAR(10)` / `Interpolation` | No | — | — | Interpolation for the outgoing interval. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `project_id, id`.
- ORM metadata declares primary-key order `id, project_id`; the migrated database order above differs, with the same key membership/uniqueness.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- Index `ix_orientation_keyframes_project_id`: `(project_id)`.
- CHECK `ck_orientation_keyframes_interpolation_to_next`: `interpolation_to_next IN ('hold', 'linear', 'smoothstep')`.
- `get_orientation`/`set_orientation` map the three scalar Euler columns to/from CameraOrientation.

#### DepthOfFieldKeyframeRecord — `depth_of_field_keyframes`

A project-scoped focus keyframe with typed focus discriminator/reference and optical parameters.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `path_position` | `FLOAT` | No | — | — | Normalized whole-path arc-length position, not time. |
| `focus_kind` | `VARCHAR(17)` / `FocusKind` | No | — | — | Center-weighted or scene-point focus. |
| `focus_scene_point_id` | `TEXT` | Yes | — | — | Required only for scene_point focus. |
| `focus_range_scale` | `FLOAT` | No | — | — | Positive focus-range multiplier. |
| `bokeh_scale` | `FLOAT` | No | — | — | Nonnegative bokeh multiplier. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `project_id, id`.
- ORM metadata declares primary-key order `id, project_id`; the migrated database order above differs, with the same key membership/uniqueness.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- Foreign key `fk_dof_scene_point`: `(project_id, focus_scene_point_id) → scene_points(project_id, id)`; no explicit ON DELETE (SQLite NO ACTION); DEFERRABLE INITIALLY DEFERRED.
- Index `ix_depth_of_field_keyframes_project_id`: `(project_id)`.
- CHECK `ck_depth_of_field_keyframes_focus_kind`: `focus_kind IN ('center_weighted_9', 'scene_point')`.
- CHECK `ck_dof_focus`: `(focus_kind = 'center_weighted_9' AND focus_scene_point_id IS NULL) OR (focus_kind = 'scene_point' AND focus_scene_point_id IS NOT NULL)`.

#### LidarKeyframeRecord — `lidar_keyframes`

An optional singleton per project, implicitly at path position zero. project_id is the primary key; id is a required public identifier but is neither a primary nor a unique database key.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `project_id` | `TEXT` | No | — | — | Owning project. |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `vertical_fov_deg` | `FLOAT` | No | — | — | Vertical field of view, strictly between 0 and 180 degrees. |
| `horizontal_resolution` | `INTEGER` | No | — | — | Horizontal sample count, 1–4096. |
| `vertical_resolution` | `INTEGER` | No | — | — | Vertical sample count, 1–256. |

- Primary key: `project_id`.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- CHECK `ck_lidar_fov`: `vertical_fov_deg > 0 AND vertical_fov_deg < 180`.
- CHECK `ck_lidar_height`: `vertical_resolution BETWEEN 1 AND 256`.
- CHECK `ck_lidar_width`: `horizontal_resolution BETWEEN 1 AND 4096`.

#### EditorRecord — `editors`

Credentials for the single application editor. The repository uses the fixed ID editor; neither a one-row CHECK nor a unique-username constraint enforces that application policy.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `username` | `TEXT` | No | — | — | Normalized editor email. |
| `password_hash` | `TEXT` | No | — | — | Argon2 password hash. |
| `credential_version` | `TEXT` | No | — | — | Version rotated on credential replacement. |

- Primary key: `id`.

#### EditorSessionRecord — `editor_sessions`

A revocable server-side session. The single-editor design has no editor_id foreign key here; JWT credential-version validation and explicit session revocation are application rules.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Opaque server-issued session identifier used for JWT revocation. |
| `expires_at` | `INTEGER` | No | — | — | Expiry as Unix time in seconds. |

- Primary key: `id`.

#### ChatMessageRecord — `chat_messages`

An ordered persisted user or assistant message within a project.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Resource identifier supplied by the application. |
| `position` | `INTEGER` | No | — | — | Zero-based order within the owning collection. |
| `role` | `VARCHAR(9)` / `ChatRole` | No | — | — | Persisted user/assistant role. |
| `content` | `TEXT` | No | — | — | Message text. |
| `project_id` | `TEXT` | No | — | — | Owning project. |

- Primary key: `id`.
- Foreign key: `(project_id) → projects(id)`; ON DELETE CASCADE.
- UNIQUE `uq_chat_messages_position`: `(project_id, position)`.
- Index `ix_chat_messages_project_id`: `(project_id)`.
- CHECK `ck_chat_messages_role`: `role IN ('user', 'assistant')`.

#### AuthChallengeRecord — `auth_challenges`

A persisted email-code challenge bound to the current credential version. It stores a code digest, never the plaintext code; it has no editor foreign key.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | No | — | — | Opaque challenge identifier. |
| `credential_version` | `TEXT` | No | — | — | Credential version the challenge belongs to. |
| `code_digest` | `TEXT` | No | — | — | Keyed digest used to verify the emailed code. |
| `expires_at` | `INTEGER` | No | — | — | Expiry as Unix time in seconds. |
| `resend_at` | `INTEGER` | No | — | — | Earliest resend time, Unix seconds. |
| `attempts` | `INTEGER` | No | — | — | Number of verification attempts already consumed. |
| `delivered` | `BOOLEAN` | No | — | — | Whether email delivery completed and the challenge is usable. |

- Primary key: `id`.

#### AuthRateLimitRecord — `auth_rate_limits`

A durable fixed-window authentication counter; expiry and counter updates are supplied by the authentication service/repository.

| Column | SQL type | Nullable | ORM insert default | SQL default | Meaning |
| --- | --- | --- | --- | --- | --- |
| `key` | `TEXT` | No | — | — | Stable budget/window bucket key. |
| `count` | `INTEGER` | No | — | — | Consumed requests in the bucket. |
| `expires_at` | `INTEGER` | No | — | — | Bucket expiry as Unix time in seconds. |

- Primary key: `key`.

### 11.4. Database constraints and service mapping

The catalogue deliberately distinguishes enforced database constraints from
business validation:

- Project-owned rows cascade on project deletion. Model-file/thumbnail cleanup
  remains the library/storage operation; a database cascade alone does not delete
  external bytes. Cloud-to-asset and segment-to-anchor references use RESTRICT;
  services remove/rewrite the dependent rows before deleting their targets.
- Aim/focus composite foreign keys include `project_id`, so they cannot reference
  a scene point in another project. They are deferred until transaction commit,
  enabling an atomic reference rewrite and deletion. Their absent ON DELETE action
  is SQLite NO ACTION, not SET NULL or CASCADE.
- Segment-to-anchor membership has an FK to `anchors.id` only. Same-project anchor
  ownership, minimum/ordered anchor counts and other trajectory invariants remain
  explicit service validation, not an extra composite FK invented by this catalogue.
- Path-position range and per-timeline position uniqueness, finite vectors,
  positive scales/speeds, resource-name limits, nonzero normals and general
  cross-resource rules come from the service/model contract. The schema has no
  hidden SQL CHECK/UNIQUE for these beyond the constraints explicitly listed.
  LiDAR bounds, enum membership and polymorphic field combinations do have the
  listed database CHECKs.
- A record's discriminator and nullable scalar columns map to the corresponding
  Pydantic union. Composite vector columns map to service Vec3 arrays. Record
  relationship objects, session/engine handles and secrets are not serialized as
  public API models. Public fields derived from other rows/storage, including
  download URLs and compiled trajectories, are not extra persisted columns.
- Credential replacement, challenge/session expiry, attempts/rate limits and the
  single-editor policy are enforced transactionally by the authentication service;
  the absence of editor FKs or a database one-row CHECK must not be mistaken for
  permission to change that behavior.

### 11.5. Schema upgrades and identifier lifecycle

**STORE-04. Job/result schema and upgrades.** Persist minimal jobs in jobs and
their ordered library results through nullable library_assets.job_id/job_position.
Exactly one successful completion is enforced by a transactional completed_at
check/CAS. Creating all assets/file rows and setting completed_at commit together.
The completion timestamp remains after result deletion and is the replay guard;
no producer-ID reservation ledger or result-fingerprint table is retained.

Upgrade from revision 20261026_0014 applies migration 20261101_0015 directly to
the final jobs/result schema, adding jobs, library result columns/index/constraints,
tags/thumbnails and file collections. No intermediate
producer-ID table or column is created. Previously released schema revisions
remain unchanged.

Existing assets have both result-link columns null; migration does not invent
producing jobs. Keep server IDs, every object key/format/size/status, transforms,
timestamps, cloud references/order and project revisions. Fresh databases and
populated upgrades reach the same schema. Repeated upgrade does not create jobs,
move/hash/copy model bytes or alter existing completion timestamps.

**STORE-05. File collections and queue schema upgrades.** Databases predating
file collections gain one main primary file for every pending/ready asset, using
its existing object key/format/size and sha256=null. Migration does not hash or
rename existing files. New tags default to [], thumbnail_key to null.

Queue transport state is external to SQLite. The migration adds no
dev inbox table. Version-1 standalone-asset bodies are quarantined by either
broker adapter, without fabricating jobs or library entries.

Fresh databases and populated upgrades agree with section 11.3. Normal operation
does not discard job state or accepted messages. Refuse a downgrade that loses
jobs, result links or multi-file references unless an explicit
backup/data-conversion procedure makes the downgrade safe.

### 11.6. Configuration and operations

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
| `CAMERA_PATH_MESSAGE_QUEUE` | none / rabbitmq / sqs; default none |
| `CAMERA_PATH_MESSAGE_QUEUE_MAX_ATTEMPTS` | Positive attempt limit; default 5 |
| `CAMERA_PATH_MESSAGE_QUEUE_LEASE_SECONDS` | SQS visibility duration only; default 60, renewed inside the SQS adapter |
| `CAMERA_PATH_RABBITMQ_URL` | Secret AMQP connection URL; default amqp://guest:guest@127.0.0.1:5672/ |
| `CAMERA_PATH_RABBITMQ_QUEUE` | Input queue name, default camera-path.job-completions; failure/retry names derive from it |
| `CAMERA_PATH_LIBRARY_IMPORT_SOURCES` | JSON source-alias map; default {}; library is reserved for the destination |
| `CAMERA_PATH_AWS_SQS_QUEUE_URL`, `CAMERA_PATH_AWS_SQS_FAILURE_QUEUE_URL` | Required distinct URLs with sqs; not used by rabbitmq/none |

Import source configuration is adapter configuration, not a core branch on
drivers. Example dev map: `{"incoming":{"driver":"local","root":"/data/incoming"}}`;
AWS map: `{"incoming":{"driver":"s3","bucket":"producer-output","prefix":"ready/"}}`.
Aliases use 1–64 ASCII letters/digits/underscores/hyphens, excluding reserved
`library`; an unknown driver, incomplete root/bucket configuration or incompatible
queue/connection configuration fails validation. Local roots are backend-host
directories; S3 identities/credentials stay in adapter configuration. Disabled
queue mode neither requires sources/AWS credentials nor starts a consumer.
SQS polling waits up to 20 seconds, checks payloads against the same 256 KiB
application limit and validates lease duration against provider bounds. Queue
unavailability is reported/retried without hanging unrelated HTTP requests or
changing `/health` into a readiness guarantee.

The AWS adapter uses the configured region/profile or standard credentials chain;
specific credentials are not part of the specification. S3/SMTP/SES are selected
in the composition root. Project operations do not depend on the bytes/email
delivery mechanism.

**OPS-04. Application composition.** Wrap the core create_app factory with a
configuration decorator in [composition.py](src/camera_path/composition.py). The
wrapper resolves Settings, accepts existing repository/storage overrides, selects
concrete adapters and injects a provider-independent AppDependencies value into
the factory. Preserve the public create_app(app_settings=None, repository=None,
library_storage=None) calling convention. Overrides take precedence over configured
storage; route capabilities follow the actual injected adapter.

Select filesystem/S3 library storage, SMTP/SES code delivery, optional RabbitMQ/SQS
message transport and each configured local/S3 import source in the wrapper.
These choices remain independent; do not infer storage or email provider from
the queue mode. Disabled message consumption builds no queue/source clients or
consumer. With second factor off, construct no email sender. Import AWS SDKs only
when their adapters are selected; ordinary local startup needs no AWS dependency,
credentials or provider connection.

The core factory creates common domain services, HTTP routes, middleware, error
handlers, OpenAPI behavior and the lifespan using injected contracts. It contains
no dev/AWS imports, provider selection or adapter-specific route registration.
AuthService receives its email sender rather than selecting/importing SMTP/SES.
The composition wrapper adds only the filesystem content/thumbnail routes when
filesystem storage is selected. It adds no job producer/status routes in any
mode; /api/v1/dev returns 404 and never appears in OpenAPI. Broker selection
changes no HTTP schemas or routes. The finished OpenAPI schema is the same for
none, rabbitmq and sqs (apart from hidden filesystem byte-serving routes).

Keep lifecycle ownership explicit: initialize the repository before serving and
start the optional consumer once per lifespan; cancel and await it on shutdown,
leaving unfinished deliveries recoverable. Close a repository created by the
wrapper, while leaving an explicitly supplied repository to its caller. Always
close queue resources, including startup/consumer failures. Adapter
composition must not initialize the database, poll queues or send email while
merely constructing/exporting the app. Apply the HTTP/storage/queue/auth contracts
and migrations defined in this specification. No debug HTTP namespace is created.

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

**HTTP-01.** The table defines 72 always-mounted canonical HTTP operations.
Message producers use the broker directly; there are no dev-only HTTP operations.
Every path includes `/api/v1`. Request/response DTO names correspond to schemas in
[openapi.json](openapi.json). The OpenAPI artifact and generated frontend clients
must agree with this inventory, including field requirements/nullability, exact
JSON shapes and idempotent replay statuses. `—` means no body. A successful `204` has no JSON content. Authentication and project
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
| `POST` | `/api/v1/jobs` | — (editor) | 201 → Job |
| `GET` | `/api/v1/jobs/{job_id}` | — | 200 → Job |
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
| `GET /api/v1/library/{asset_id}/content` | Local adapter only, public ready primary-file bytes |
| `GET /api/v1/library/{asset_id}/files/{file_id}/content` | Local adapter only, public ready bytes for the selected owned representation; LIB-13 |
| `GET /api/v1/library/{asset_id}/thumbnail` | Local adapter only, public ready raster image; LIB-09 |

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
| DATA-01–04, API-01–07, HTTP-01 | Fields/types/defaults, resource shapes, ETag/If-Match, stale/missing/malformed revision, legacy compatibility, schema | `test_openapi.py`, `test_api.py` |
| PROJECT-01–02, SCENE-01–04, STORE-01–03 | CRUD, reset/clear distinctions, FK/cascade, unrelated data, restart, record/schema mapping | `test_api.py`, `test_resource_integrity.py`, `test_repository.py`, `test_migration.py`, `test_enum_columns.py` |
| TIME-01–05 | Defaults, duplicate positions, delete/recreate, static LiDAR singleton | `test_delete_timelines.py`, `test_depth_of_field_timeline.py`, `test_lidar_timeline.py` |
| GEOM-01–06 | Endpoints, C² spline, tangent constraints, unchanged spirals, adaptive approximation, distance/time | `test_geometry.py`, `test_trajectory_planner.py` |
| LIB-01–05, CLOUD-01–02 | Real small PLY/SOG bytes, complete/retry, instances/defaults/order, delete rollback | `test_library.py`, `test_s3_library.py`, `test_project_clouds.py`, `test_library_delete.py`, `test_library_bulk_delete.py` |
| LIB-06–12, STORE-04 | Server asset IDs, manual uploads, tags, unique thumbnail ownership/URLs; existing assets remain ungrouped and retain their files | Library HTTP scenarios, populated-database upgrade and storage-adapter checks |
| LIB-13–16, STORE-05 | Several assets/files per completion; primary aliases; adopted/copied objects; hash/size/signature checks; all-results atomicity; legacy main entry; deletion/rollback/recovery and ownership races | Isolated local completion/storage and populated-upgrade scenarios |
| JOB-01–03 | Empty job creation; public reads; unknown job rejection; completed_at and ordered relationship; first-completion wins; concurrent/new-message-ID replays; result deletion never reopens/recreates | Autonomous job/completion HTTP scenarios and transactional failure/restart checks |
| QUEUE-01–03 | Real RabbitMQ publication; no debug HTTP routes in any mode; body/UUID normalization; durable messages; restart/redelivery; retry/exhaustion and post-commit ack loss | Autonomous HTTP + real broker scenarios and focused queue-contract/failure-injection checks |
| QUEUE-04 | Same payload and handler; SQS polling/ack/visibility/failure forwarding; provider-independent core | Deterministic adapter contract checks; separately recorded live AWS acceptance |
| AUTH-01–05, PROFILE-01 | Email flow, invalid/replayed tokens, persistent attempts, concurrent verify, logout, partial settings | `test_auth.py`, `test_email_auth.py`, `test_user_settings.py`, `test_config.py` |
| OPS-04 | Independent RabbitMQ/SQS and storage selection; invariant HTTP/OpenAPI; provider-free core; consumer/queue/repository lifecycle | Composition checks and autonomous dev/default HTTP scenarios |
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
changes, check links, the operation/DTO inventory and `git diff --check`. For record
catalogue changes, compare every mapped column/default/constraint with ORM metadata
and an isolated database upgraded through Alembic; retain explicit distinctions
between Python defaults and migrated SQL defaults/key order. Running the full
runtime suite alone does not establish prose accuracy.

**CHECK-03.** Any replacement backend preserves the external contract, permissions,
persisted data and revision semantics, or includes an explicitly agreed specification
change. Numerical comparisons use documented tolerances; byte-for-byte JSON float
equality is unnecessary.

## 14. Limitations and open questions

**GAP-01.** Implementation defects do not define expected behavior. A current
revision permits a valid edit, including anchor deletion and spiral recreation;
a stale revision produces a conflict without data loss. Unexpected conflicts
require diagnosis against that contract, not adoption as a product requirement.

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

**GAP-04.** Container-signature checks do not constitute a complete server-side
3DGS parser. Imports verify SHA-256; legacy/manual files may retain sha256=null.
A global file-count quota and a finished lifecycle for expired pending manual
uploads are not specified. The per-file declared-size limit is 2 GiB. A signed
S3 PUT does not by itself prevent oversized bytes before completion validation.

**GAP-05.** Older documents/README text may lag behind the contract. In particular,
descriptions of snapshot undo/redo, a mandatory aim key at zero, a Catmull–Rom planner
or deformation of analytic spirals at spline junctions do not define the current
implementation. Internal Project excludes clouds. Complete project export,
revisioned library/profile, cloud transform editing, compilation caching and
multi-user access are not yet specified.

## 15. Sources and implementation map

Source links locate implementation entrypoints; they do not replace the
requirements above. DATA-05 defines the required model/record naming convention;
the other links do not freeze the file structure during refactoring.

| Area | Source |
| --- | --- |
| HTTP composition / errors | [api.py](src/camera_path/api.py), [composition.py](src/camera_path/composition.py), [routers/](src/camera_path/routers/) |
| DTOs and defaults | [models.py](src/camera_path/models.py); DTOs in services/library.py, services/project_clouds.py, services/user_settings.py, routers/auth.py |
| Database records | [persistence/records.py](src/camera_path/persistence/records.py); SQLAlchemy record classes as defined in DATA-05 |
| Application operations | [services/](src/camera_path/services/) |
| Revision CAS | [revisions.py](src/camera_path/services/revisions.py), [dependencies.py](src/camera_path/routers/dependencies.py) |
| Persistence / repositories / migrations | [persistence/](src/camera_path/persistence/), [repositories/](src/camera_path/repositories/), [alembic/](alembic/) |
| Geometry | [trajectory/](src/camera_path/trajectory/) |
| LLM orchestration / tools | [trajectory_agent.py](src/camera_path/agent/trajectory_agent.py) |
| Local / AWS adapters | [dev/](src/camera_path/dev/), [aws/](src/camera_path/aws/) |
| Runbooks | [backend/README.md](README.md), [infra/README.md](../infra/README.md) |
