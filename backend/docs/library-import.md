# Queued library imports

The monolith consumes one versioned JSON descriptor per library item. Queue and storage
providers are selected independently. File production, queue provisioning and generation jobs
are outside the importer. The canonical contract is [SPECS.md](../SPECS.md), sections 3.8 and 8.2–8.3.

## Local verification

From `backend/`, install dependencies and upgrade your development database **before** starting:

```sh
uv sync --frozen
uv run alembic upgrade head
```

Add to your untracked `.env` (choose an actual absolute source directory):

```dotenv
CAMERA_PATH_MESSAGE_QUEUE=dev
CAMERA_PATH_LIBRARY_IMPORT_SOURCES='{"incoming":{"driver":"local","root":"/absolute/generated"}}'
```

Run the backend with the normal `uv run camera-path` command. Sign in through the existing
password/email-code flow described in the README; use its editor Bearer token below. The dev
import routes require authentication, including the status GET. They are absent with the default
`CAMERA_PATH_MESSAGE_QUEUE=none` and in AWS mode. Production configuration rejects the dev adapter.

A descriptor can be generated from already completed, real SOG/PLY files:

```sh
python3 - /absolute/generated/tree.sog /absolute/generated/tree.ply > item.json <<'PY'
import hashlib
import json
import sys
from pathlib import Path
from uuid import uuid4

files = []
for index, argument in enumerate(sys.argv[1:]):
    path = Path(argument)
    with path.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    files.append({
        'id': f'file-{index}', 'format': path.suffix[1:].lower(),
        'size_bytes': path.stat().st_size, 'sha256': digest,
        'source': {'storage': 'incoming', 'path': path.name},
    })
print(json.dumps({
    'schema_version': 1, 'message_id': str(uuid4()),
    'item': {'client_id': str(uuid4()), 'name': 'Tree', 'tags': ['tree'],
             'thumbnail_key': None, 'primary_file_id': files[0]['id'], 'files': files},
}, indent=2))
PY
```

`source.storage` is a configured alias, and `path` is relative to its root. A path refers to a
file accessible to the **backend host**, not a file on a remote HTTP caller's machine. Sending
JSON does not upload the model bytes. For an object already in library storage, use
`{"storage":"library","path":"tree.sog"}`. Such objects retain their names and are adopted without
copies; objects already owned by another item cannot be adopted. External files are copied into
the library as `<UUID>.<format>` and their originals remain untouched. Registering an object makes
the library responsible for deleting that object when the item is later deleted.

```sh
curl -sS http://127.0.0.1:8000/api/v1/dev/library-imports \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data-binary @item.json
# 202: {"message_id":"..."}

curl -sS http://127.0.0.1:8000/api/v1/dev/library-imports/MESSAGE_UUID \
  -H "Authorization: Bearer $TOKEN"
```

`202` means the message is durably accepted, not that the item is already ready. Status is
`queued`, `processing`, `succeeded` (with `asset_id`) or `failed` (with `error_code`). Messages,
leases and results survive restarts. Transient failures retry up to five times by default;
validation and identity conflicts are retained as terminal failures. Keep the same descriptor
and client ID for retries. Resubmitting an identical message ID returns its original status
without resetting attempts. A corrected failed message needs a new message ID; a new logical
item needs a new client ID. A deleted client's ID remains reserved.

The item appears in ordinary library reads only after all files and any thumbnail validate.
`files` includes all representations; `primary_file_id` selects one. The familiar `format`,
`size_bytes` and `download_url` describe that primary file, preserving existing cloud rendering.
A thumbnail is a separate existing library object under
`thumbnails/<client_id>/<filename>.png|jpg|jpeg|webp`, at most 5 MiB, not an entry in `files`.

Ordinary one-file uploads still work. Existing databases gain one primary `main` file per item
without renaming/moving bytes. Migration does not hash old files; imports verify SHA-256, byte
size and container signatures. Signatures are not full 3DGS decoding. Interrupted copies have
storage recovery markers under `_imports/`; the consumer periodically recovers expired attempts,
checking committed ownership before deleting orphan copies. Do not edit those internal markers.

Default OpenAPI is exported to `openapi.json`. The dev profile includes the two conditional
operations and can be reproduced with:

```sh
uv run openapi-export --dev openapi.dev.json
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
uses item identity and verified descriptors, and deletes a delivery only after commit/replay.
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
dev backend, temporary source/library directories, a durable SQLite inbox, actual email-code
login over a local SMTP sink, process restarts and idempotent replay. It needs no AWS services.
Backend tests additionally exercise SQS SDK requests/failure forwarding, SQL/storage failure
recovery, concurrent imports and populated-database migration/downgrade guards.
