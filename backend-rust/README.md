# Rust backend — CP-119

This is a native Rust implementation of the Camera Path backend. Python is not called by the
server, migrations, authentication, geometry compiler or queue consumers. The Python backend
remains in `backend/` as the migration reference and rollback implementation.

## Build and run

Use Rust 1.99.0 (pinned in `rust-toolchain.toml`). Dependency versions are fixed by Cargo.lock.
From the repository root:

```sh
cargo build --locked --manifest-path backend-rust/Cargo.toml
export CAMERA_PATH_DATABASE_URL='sqlite+aiosqlite:///./development.sqlite3'
export CAMERA_PATH_LIBRARY_DIRECTORY='./development-library'
# Supply a random secret of at least 32 bytes through your environment or .env.
export CAMERA_PATH_JWT_SECRET='<your-random-secret>'
backend-rust/target/debug/camera-path migrate
backend-rust/target/debug/camera-path editor-create you@example.com
backend-rust/target/debug/camera-path serve --host 127.0.0.1 --port 8000
```

`editor-create` prompts twice for a password, as before. The default dev profile uses local
files and loopback SMTP on port 1025; configure an inbox such as Mailpit for interactive use.
The automated test harness creates its own SMTP receiver and needs no Docker or email account.
An unconfigured broker does not prevent HTTP startup. Existing `CAMERA_PATH_*` database,
storage, auth, profile, CORS, compilation and OpenAI settings are retained. `.env` is loaded
from the process working directory. Relative SQLAlchemy SQLite URLs keep their relative meaning.
The CLI also offers `openapi-export <path>`.

For AWS, build with `--no-default-features --features aws`. Select
`CAMERA_PATH_AWS_LIBRARY_STORAGE=s3`, the existing bucket/prefix/region, and
`CAMERA_PATH_AUTH_EMAIL_DELIVERY=ses`. Production still requires email second factor and SES.
The standard AWS credential chain supports EC2 roles; dev does not initialize AWS SDK clients.
Set `OPENAI_API_KEY` to enable the agent; `OPENAI_BASE_URL` is supported for protocol fixtures.

## Workspace and boundaries

| Crate | Responsibility |
| --- | --- |
| camera-path-core | Typed domain models, SeaORM entities/repositories/migrations, validation, revisions, geometry, auth, agent orchestration and neutral queue commands |
| camera-path-app | Axum, Tokio lifecycle, HTTP/JSON/SSE, configuration, Utoipa and adapter composition |
| camera-path-storage-local | Filesystem streams, atomic upload promotion, recoverable deletion staging |
| camera-path-storage-s3 | Presigned S3 transfers, immutable ready-object promotion and deletion recovery |
| camera-path-email-smtp | Dev SMTP delivery |
| camera-path-email-ses | AWS SES delivery |
| camera-path-openai | Responses API HTTP/SSE adapter using reqwest |
| camera-path-queue-rabbitmq | Dev AMQP transport and acknowledgement |
| camera-path-queue-sqs | AWS SQS transport and acknowledgement |

Each crate has its own manifest. The core contains ORM/models by design; it depends on neither
AWS SDK/config, lapin, Axum, reqwest nor concrete adapters. Its ports expose email delivery,
file operations/streams and language-model events through neutral types. The app selects
implementations. SQLite does not need TLS, so the ORM uses `runtime-tokio` without a TLS provider.
Check the independent core graph with:

```sh
cargo tree --manifest-path backend-rust/Cargo.toml -p camera-path-core --edges normal
cargo check --manifest-path backend-rust/Cargo.toml -p camera-path-core --locked
```

Password hashing and CPU-heavy numerical compilation run through `spawn_blocking`. SQL writes
acquire SQLite's write lock before reading and compare revisions in the same transaction,
including across processes. Read aggregates use a consistent transaction. The compatibility
aggregate currently rewrites its normalized resource rows transactionally while retaining IDs,
insertion order and unrelated cloud instances; large-project optimization can later narrow writes.

The v1 compatibility OpenAPI artifact remains `backend/openapi.json`: it supplies operation IDs,
request schema validation and unchanged frontend DTOs. Utoipa supplies native route documentation.
Public reads, editor-only mutations, structured errors, ETags, the agent tool schemas and SSE
are retained. Historical `/projects` routes retain aggregate responses and their original statuses.

## Run the same integration suite

```sh
uv sync --frozen --project integration
python3 backend-rust/tools/run_api_tests.py
```

The helper supplies only the server, schema-bootstrap and editor-bootstrap commands to the
unchanged CP-118 suite. Its expectations are not rewritten for Rust. Every scenario uses a
fresh SQLite database, library, signing secret, real SMTP flow and local model HTTP peer.
There are 92 fast scenarios; successful resend/expiry is deliberately a separate six-minute run:

```sh
CP_TEST_SLOW_AUTH=1 python3 backend-rust/tools/run_api_tests.py \
  integration/tests/test_auth.py::test_real_resend_and_expiry_without_clock_override
cargo test --locked --manifest-path backend-rust/Cargo.toml --workspace --all-features
```

The core test compares ten deterministic Python reference scenes (splines, irregular spacing,
connected runs, spirals, tangent constraints, surface-normal lift, speed integration and resolved
aim) to Rust with absolute tolerance `1e-5`. The compiler's adaptive approximation tolerance is
`1e-3`. Fixture generators under `tools/` are one-time development tools, not server dependencies.

## Migrate existing SQLite safely

Stop every writer, including queue consumers. Keep a SQLite online-backup copy (not a file copy
of an active WAL database), the original library files and the preceding release/environment.
Run migration on that copy and verify it before switching the service. Never migrate the only copy.

The accepted starting Alembic revision is **20261026_0014**. Older databases must first be upgraded
using the preceding Python release. Migration validates expected columns, SQLite type affinities,
primary keys, nullability, foreign keys and existing foreign-key integrity. An unknown/incomplete
schema is rejected before SeaORM's migration bookkeeping changes. Existing IDs, tables, records,
password hashes, challenges, sessions and file keys are retained. SeaORM adds its migration ledger
and `processed_commands` deduplication ledger. A fresh database creates the equivalent normalized
schema and records the legacy baseline explicitly. Re-running migration is idempotent.

```sh
uv sync --frozen --project backend --extra aws
uv sync --frozen --project backend-rust/verification
backend-rust/verification/.venv/bin/python -m pytest \
  -c backend-rust/verification/pyproject.toml backend-rust/verification/test_migration.py --tb=short
```

That check creates a real, populated Python/Alembic database, stops it, migrates a copy, compares
all resources/files/revisions and existing authentication in Rust, edits data, and starts Python
against the Rust-written copy. It also rejects an unknown schema without modifying the database.
Use `CP_PYTHON_BIN` or `CP_RUST_BINARY` for explicit local reference executables.

Automatic destructive `down` migrations are disabled. Rollback means stopping writers, restoring
the pre-release SQLite backup (including correct WAL/SHM cleanup), restoring the previous release,
runtime selection and environment, then checking health. The tested reverse-read compatibility
helps diagnosis; it does not replace a backup, especially after future schema migrations.

## Queue ingress and provider verification

Queue processing is inside the same monolith. A versioned neutral envelope currently exposes
`rename_project` as a small real domain operation to establish the ingress contract; inference,
result import and the remaining Trellis operations are subsequent tasks.

```json
{"version":1,"idempotency_key":"stable-external-command-id","command":{"type":"rename_project","project_id":"existing-project-id","name":"Updated name"}}
```

The business write and durable deduplication marker commit together. An identical retry is
acknowledged without another revision; reusing the key with a different payload is rejected.
Keep these deduplication records for the lifetime of possible retries; no unsafe automatic expiry
is applied. HTTP and queue commands share the same core and database; there is no internal HTTP hop.

- RabbitMQ: `CAMERA_PATH_QUEUE=rabbitmq`, `CAMERA_PATH_RABBITMQ_URL`, `CAMERA_PATH_QUEUE_NAME`.
  The adapter declares a durable quorum queue with prefetch 1, delivery limit 5 and a durable
  `<queue>.dead` DLQ/exchange. Existing queues must have matching arguments. Invalid/permanent
  errors are dead-lettered; transient failures are requeued with backoff. Disconnects reconnect.
- SQS: `CAMERA_PATH_QUEUE=sqs`, `CAMERA_PATH_SQS_QUEUE_URL`, `CAMERA_PATH_SQS_DLQ_URL`.
  Use standard queues. Configure the source queue's redrive policy/maxReceiveCount for transient
  failures; the adapter directly copies invalid/permanent messages to the explicit DLQ before
  deleting the source. That forwarding can duplicate a DLQ entry after a network failure, but
  never acknowledges an unstored rejection. Long polling is 20 seconds and visibility is 60 seconds.
  The current command completes quickly; long-running future commands need visibility renewal.

Delivery tags and receipt handles stay in adapters. Acknowledgement follows commit. Shutdown
stops receiving and waits for an in-flight command; interrupted/unacknowledged messages can
redeliver. RabbitMQ and SQS offer different ordering/retry controls; only the stated common
at-least-once/idempotent application contract is assumed. Broker access is trusted ingress:
restrict credentials/IAM/network reachability separately from public editor HTTP authentication.

```sh
docker compose -p cp119-test -f backend-rust/compose.test.yml up -d --wait
CP_TEST_PROVIDERS=1 backend-rust/verification/.venv/bin/python -m pytest \
  -c backend-rust/verification/pyproject.toml backend-rust/verification/test_providers.py --tb=short
# Always clean up, including after a failed verification:
docker compose -p cp119-test -f backend-rust/compose.test.yml down -v
```

Build with `--all-features` for that profile. Images are pinned by digest and ports bind only
loopback. Tests drop a real AMQP Basic.Ack / fail a real SQS DeleteMessage after DB commit,
restart the consumer and verify a single application/revision, duplicates, invalid payloads and
DLQ recovery. They also exercise S3 promotion/immutability/deletion and SES email verification.
RabbitMQ is real; **SQS, S3 and SES are Moto emulations, not live AWS/IAM/TLS/delivery checks**.
Only fake credentials are used. No production resources are touched.

## Deployment handoff

The existing EC2, EBS, S3, Nginx/HTTPS and SSM release path is retained. Python remains the default
release runtime. `CP_BACKEND_RUNTIME=rust` explicitly selects a checksum-verified, exact-revision
Linux artifact; this is an opt-in deployment step after review, not something the test commands do.

On Linux matching the instance (currently x86_64 Ubuntu 24.04):

```sh
cargo build --release --locked --manifest-path backend-rust/Cargo.toml --no-default-features --features aws
python3 backend-rust/tools/package_release.py --binary backend-rust/target/release/camera-path \
  --output /tmp/camera-path.tar.gz
```

The packaging helper requires committed source and records the revision/target. Upload the
reviewed artifact separately to the existing backup bucket under the suggested `releases/<sha>/`
key; deployment requires `CP_RUST_ARTIFACT_KEY` and `CP_RUST_ARTIFACT_SHA256`. CDK adds GetObject
only for that release-artifact prefix, keeping database backup history unreadable by the app.
Neither packaging nor verification uploads anything or deploys infrastructure.

The existing release script downloads/verifies the archive and Linux ELF architecture before
stopping the old service. It then takes/uploads the SQLite backup, migrates with the new binary,
switches code and a systemd runtime override, and checks local HTTP and Nginx HTTPS health.
Failure restores DB, code, environment and the preceding runtime override. Runtime/artifact
settings stay out of EC2 UserData, so opting into Rust does not replace/restart EC2 via bootstrap
or recreate its storage. Queue infrastructure/IAM for a production SQS consumer must be supplied
with the subsequent queue rollout; the existing HTTP app starts with queue ingress disabled.

No production deployment or real AWS provider check was performed by this implementation.
