# Queued job completion and library results

The monolith reserves minimal jobs and consumes one versioned completion message containing
all result assets for a job. Queue and storage providers are selected independently. File
production, queue provisioning and generator execution remain outside this handler. The canonical contract is [SPECS.md](../SPECS.md), sections 3.8 and 8.2–8.3.

## Local verification

From `backend/`, install dependencies and upgrade your development database **before** starting:

```sh
uv sync --frozen --extra rabbitmq
docker compose up -d --wait
uv run --extra rabbitmq alembic upgrade head
```

Add to your untracked `.env` (choose an actual absolute source directory):

```dotenv
CAMERA_PATH_ENVIRONMENT=development
CAMERA_PATH_AWS_LIBRARY_STORAGE=local
CAMERA_PATH_MESSAGE_QUEUE=rabbitmq
CAMERA_PATH_RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672/
CAMERA_PATH_RABBITMQ_QUEUE=camera-path.job-completions
CAMERA_PATH_LIBRARY_IMPORT_SOURCES='{"incoming":{"driver":"local","root":"/absolute/generated"}}'
```

Run the backend with `uv run --extra rabbitmq camera-path`. The adapter lazily connects over
AMQP, declares durable input, retry and failure queues, and subscribes with manual acknowledgements.
The broker's management UI is at <http://127.0.0.1:15672> (`guest` / `guest`). Both broker ports
are bound to loopback. Compose preserves messages in its `rabbitmq-data` volume across restarts.
Stop the broker with `docker compose down`; this keeps that volume.

There are no `/api/v1/dev` routes in any mode. Producers use broker credentials rather than an
editor JWT. An unavailable broker does not stop the ordinary HTTP API; the consumer reconnects.

Ordinary job creation is still an editor operation. Use an editor token from the normal
password/email-code sign-in flow as `TOKEN` for that request only.

Reserve an empty job (this does not start generation), from a second terminal:

```sh
export TOKEN='YOUR_EDITOR_ACCESS_TOKEN'
JOB_ID=$(curl -fsS -X POST http://127.0.0.1:8000/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "$JOB_ID"
```

Put your completed files under the configured source root. For two PLY representations of the
same asset, for example `/absolute/generated/cloud-full.ply` and
`/absolute/generated/cloud-preview.ply`, generate an actual request using their sizes and hashes:

```sh
# Run from backend/, using Python 3.11+.
python3 examples/make_job_completion.py \
  --job-id "$JOB_ID" --source-root /absolute/generated --name "My cloud" \
  /absolute/generated/cloud-full.ply /absolute/generated/cloud-preview.ply > completion.json
cat completion.json
```

The [JSON example](../examples/job-completion.multiple-ply.json) shows the full shape with two
PLY files. Its job UUID, byte sizes and hashes are illustrative: generate your own JSON with the
command above. The helper reads files locally, streams SHA-256, generates a new message UUID and
writes JSON to stdout; it neither submits anything nor starts a job. Paths must lie below the
source root. A relative subdirectory is preserved in `source.path`.

This creates **one asset with two file representations**, with `file-1` as primary. To publish
two independent library items, use two entries in `assets`, each containing its own `files` and
`primary_file_id`. Every source object may be used only once within the completion.

`source.storage` is a configured alias, and `path` is relative to its root. A path refers to a
file accessible to the **backend host**, not a file on a remote HTTP caller's machine. Sending
JSON does not upload the model bytes. For an object already in library storage, use
`{"storage":"library","path":"tree.sog"}`. Such objects retain their names and are adopted without
copies; objects already owned by another item cannot be adopted. External files are copied into
the library as `<UUID>.<format>` and their originals remain untouched. Registering an object makes
the library responsible for deleting that object when the item is later deleted.

```sh
# Wrap the file in RabbitMQ's management-API publication envelope.
python3 -c 'import base64,json,sys; json.dump({"properties":{"delivery_mode":2,"content_type":"application/json"},"routing_key":"camera-path.job-completions","payload_encoding":"base64","payload":base64.b64encode(sys.stdin.buffer.read()).decode()},sys.stdout)' \
  < completion.json > /tmp/rabbitmq-publish.json

curl -fsS -u guest:guest \
  http://127.0.0.1:15672/api/exchanges/%2F/amq.default/publish \
  -H 'Content-Type: application/json' --data-binary @/tmp/rabbitmq-publish.json
# {"routed":true} — accepted by the broker, not yet a completed job.

curl -fsS "http://127.0.0.1:8000/api/v1/jobs/$JOB_ID" | python3 -m json.tool
```

If you change `CAMERA_PATH_RABBITMQ_QUEUE`, use that name as `routing_key` too. Wait until the
backend has declared its queue (visible in the management UI); `routed:false` means no queue
received the message. Only the broker receives this HTTP request; the backend consumes via AMQP.

Transient failures retry up to five times by default, using separate TTL retry queues so they do
not block unrelated jobs. Terminal/exhausted messages are forwarded to
`camera-path.job-completions.failed` with an `error_code` header before the input is acknowledged.
Inspect them in the management UI, or peek without removing a message:

```sh
curl -fsS -u guest:guest \
  http://127.0.0.1:15672/api/queues/%2F/camera-path.job-completions.failed/get \
  -H 'Content-Type: application/json' \
  -d '{"count":1,"ackmode":"ack_requeue_true","encoding":"auto"}' | python3 -m json.tool
```

There is no per-message application status resource. Correct a failed descriptor and publish
with a new message ID for the same pending job. Message IDs are diagnostics, not a body registry.

Read `GET /api/v1/jobs/JOB_UUID` to obtain `completed_at` and the ordered `assets` array.
Repeat that read while processing; success means a non-null job `completed_at` and both files
in the result asset. Their returned `download_url` values can be opened or fetched.
A new experiment after a successful
completion needs a new job ID; resubmitting to the completed job will not replace its results.

Unknown jobs are rejected before source reads. For a pending job, all assets, files and thumbnails must
validate before one transaction creates ready assets and marks the job completed. Nothing is
published if any result fails. **The first successful completion wins**: later well-formed
completions are successful no-ops, without reading sources, replacing results or changing the
timestamp. Deleted result assets disappear from the job, and replay does not recreate them.

Each asset has nullable `job_id`. `files` includes all representations; `primary_file_id` selects
one. `format`, `size_bytes` and `download_url` describe that primary file, preserving cloud
rendering. A thumbnail is a separate existing library object under
`thumbnails/<UUID>.png|jpg|jpeg|webp`, at most 5 MiB, not an entry in `files`. The filename UUID is
only an object name. Different assets cannot share a file or thumbnail object.

Ordinary one-file uploads always create a fresh pending asset, with `job_id: null`. The migration
chain adds one primary `main` file per pre-existing item without moving bytes. Imports verify
SHA-256, byte size and container signatures; signatures are not full 3DGS decoding. Interrupted
copies have recovery markers under `_imports/`; expired attempts are cleaned only after checking
committed ownership. Do not edit these internal markers.

Migration `20261101_0015` upgrades the previous single-file library directly to jobs, result
links, tags/thumbnails and file collections, without a SQL queue table. Existing assets keep their IDs,
object keys, transforms and project references; they remain ungrouped, with one primary `main`
file and no computed hash. Fresh databases reach the same schema. Downgrade refuses to discard
jobs or multiple representations. Queue state stays in the broker. New producers send version 2; version-1
messages are rejected.

The same public OpenAPI is exported to `openapi.json` for every queue provider:

```sh
uv run --extra rabbitmq openapi-export openapi.json
```

## AWS profile

Install `uv sync --frozen --extra aws`. Configure the existing S3 library settings and:

```dotenv
CAMERA_PATH_MESSAGE_QUEUE=sqs
CAMERA_PATH_AWS_SQS_QUEUE_URL=https://sqs.REGION.amazonaws.com/ACCOUNT/imports
CAMERA_PATH_AWS_SQS_FAILURE_QUEUE_URL=https://sqs.REGION.amazonaws.com/ACCOUNT/import-failures
CAMERA_PATH_LIBRARY_IMPORT_SOURCES='{"incoming":{"driver":"s3","bucket":"producer-output","prefix":"ready/"}}'
```

The SQS body is the same complete JSON descriptor, not an S3 notification or a manifest URL.
A producer sends it after all files are complete. Standard queues may redeliver; the handler
uses persisted job completion state and deletes a delivery only after commit/replay.
Visibility is refreshed during long copies. Terminal/exhausted failures are forwarded durably to
the configured failure queue before deleting the original; failure forwarding can itself be
redelivered. The failure queue must not be fed back into the import consumer.

Create/configure both queues and the EC2 role manually. Permissions include ReceiveMessage,
DeleteMessage and ChangeMessageVisibility on the input queue, SendMessage on the failure queue,
GetObject on sources, and GetObject/PutObject/DeleteObject on the destination library prefix.
Recovery additionally needs ListBucket scoped to the library `_imports/` prefix. No public import
endpoint, SNS topic or S3 notification configuration is required. Lease seconds default to 60
(`CAMERA_PATH_MESSAGE_QUEUE_LEASE_SECONDS`); max attempts default to 5
(`CAMERA_PATH_MESSAGE_QUEUE_MAX_ATTEMPTS`). Ordinary HTTP remains available during queue outages.

Local SDK-contract tests are not an AWS deployment or acceptance run. The user separately
configures AWS and verifies copying/adoption, multiple files, permissions, retry/visibility,
failure forwarding and restart recovery with real resources.

## Autonomous checks

See [integration/README.md](../../integration/README.md). The full HTTP suite includes an isolated
backend, temporary source/library directories, a disposable real RabbitMQ broker, actual email-code
login over a local SMTP sink, process/broker restarts and idempotent replay. Docker must be running;
the suite creates and removes its own container and needs no AWS services or credentials.
Backend tests additionally exercise SQS SDK requests/failure forwarding, SQL/storage failure
recovery, concurrent completions, atomic multi-asset publication and populated-database upgrade guards.
