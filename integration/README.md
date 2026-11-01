# Autonomous backend API tests (CP-118)

These tests exercise a **real backend subprocess over loopback HTTP**, including real SMTP
code delivery. The test client has its own locked Python environment containing only pytest
and httpx; it does not import `camera_path`, FastAPI, SQLAlchemy, JWT helpers or app fixtures.
No Docker, AWS account, email account, OpenAI key, browser or running development app is needed.

## Run from the repository root

```sh
uv sync --frozen --project backend
uv sync --frozen --project integration
integration/.venv/bin/python -m pytest -c integration/pyproject.toml integration/tests \
  --require-api-coverage --api-report=integration/api-coverage.json
```

These paths assume the repository root, not the `integration/` directory. If your terminal
is already in `integration/`, use this equivalent sequence:

```sh
uv sync --frozen --project ../backend
uv sync --frozen
.venv/bin/python -m pytest tests --require-api-coverage --api-report=api-coverage.json
```

The autonomous suite runs against local filesystem storage and SMTP. Install the optional
backend `--extra aws` only when also running the existing unit suite's mocked SES tests.
Dependencies must be installed once; the actual test run requires only loopback networking.
No environment activation is needed: use the explicit Python path shown above. The fast suite
usually takes about two minutes locally. Verbose output names each running test; the first
one prepares the database/editor and exercises email login and two real server restarts.
CI also runs this suite under a pseudo-terminal to cover interactive-terminal startup.

For a focused run, omit `--require-api-coverage` and select a test or module normally.
The full run creates a JSON operation/status inventory; it deliberately never records request
bodies, tokens, passwords or email codes. Do not infer complete semantic coverage from merely
hitting a route: the scenarios below explain what is actually verified.

## Isolation and email authentication

Each stateful scenario gets a fresh temporary directory, SQLite database, library directory,
random signing secret/password, ephemeral HTTP port, local SMTP sink and local OpenAI-compatible
HTTP fixture. A session-scoped unauthenticated server is shared only by the write-access matrix.
The subprocess receives an allowlist of environment variables, not your provider credentials,
proxy settings or Python path. It starts in the temporary directory, outside any `.env`.
The Alembic bootstrap uses a temporary config with an absolute migrations path and also runs
from that temporary directory. The checkout's `.env` is never read.

The default administrative bootstrap is **Alembic upgrade + the existing `editor-create` CLI**.
The CLI receives a generated password over stdin, never a command-line argument. That is the
only application-specific setup. The bootstrap CLI runs in a separate session so Python's
`getpass` cannot read from your terminal instead of the supplied stdin. You should never be
prompted to enter the test editor's password. Test assertions never query SQLite or read
backend internals.

The production auth implementation is unchanged: password → persisted challenge → SMTP email
→ HTTP code verification → server-issued token. Codes are read from a test-owned SMTP socket,
not a database, log, fixed code, dependency override or test-only login route. Logout, replay,
wrong-code lockout, concurrency, rate limits, delivery failure and process restarts are tested.

Resend success and natural challenge expiry require wall-clock waits. The ordinary suite tests
resend cooldown and invalid/locked challenges; the slow scenario is explicit:

```sh
CP_TEST_SLOW_AUTH=1 integration/.venv/bin/python -m pytest -c integration/pyproject.toml \
  integration/tests/test_auth.py::test_real_resend_and_expiry_without_clock_override
```

This takes about six minutes. No application clock is monkeypatched. CI can run it with the
`slow_auth` workflow-dispatch input. The coverage gate lists `resendEditorCode` as the only
operation allowed without a successful status in the fast run.

## Coverage and limits

- All versioned write operations: unauthenticated and invalid-token requests denied.
- Public reads, public viewer settings, protected session, OpenAPI operation inventory, CORS and structured errors.
- Projects and metadata, rename/reset/delete, independent projects, fresh/missing/malformed/stale
  ETags, concurrent writes, validation atomicity and actual process-restart persistence.
- Anchors, scene points and references/cascades; spline compilation with a straight-line length
  tolerance; spiral recreation after deleting a segment and anchor (CP-117 sequence).
- Speed, aim, orientation, DOF keyframe CRUD, entire timeline removal and preservation of other
  resources; default settings, DOF initialization and LiDAR enable/update/remove/validation.
- PLY and SOG storage round trips, pending/ready visibility, upload permissions, size/header
  rejection, immutable completed uploads, defaults, independent cloud instances, reordering,
  restart, detach, cascading deletion and atomic bulk-delete failure.
- User-message idempotency/conflict, chat clearing, real OpenAI SDK HTTP calls to a local fixture,
  a deterministic tool round, persisted assistant history, SSE delta/result/headers, upstream
  failure and incomplete upstream streams.

The tiny SOG fixture checks the backend's container-signature contract, not renderer decoding.
SSE checks use the real HTTP stream and its events, but do not establish browser rendering,
backpressure or cancellation of an LLM request after client disconnect. OpenAI output is a
controlled external protocol fixture, not an assertion about actual model quality. These tests
exercise HTTP API contracts, not Nginx/TLS/SES/S3 live infrastructure or frontend bug CP-106.
The historical unversioned compatibility API is outside the success-coverage gate.

CP-117's HTTP sequence always reads the latest ETag. Passing it does **not** prove that the
frontend correctly refreshes its revision; it tests the server prerequisite for that fix.

## Run against a future backend implementation

The harness manages a disposable backend; it intentionally does not point destructive tests
at an arbitrary already-running or production URL. Override these **command strings** to reuse
the same HTTP expectations for Rust. Commands are split with `shlex`, executed without a shell,
and must be trusted local commands:

- `CP_TEST_SERVER_COMMAND`: foreground server command; `{port}` is replaced with the allocated
  loopback port. Must use the temporary environment's database/storage settings.
- `CP_TEST_BOOTSTRAP_COMMAND`: noninteractive schema bootstrap, run from the temporary directory.
- `CP_TEST_EDITOR_COMMAND`: administrative editor setup; `{email}` is replaced, password is
  supplied twice on stdin as with today's CLI. Run from the temporary directory.

The new implementation must accept the same test configuration (or supply a wrapper translating
it), support `/health`, and talk to the test SMTP and OpenAI endpoints. Keep `backend/openapi.json`
as the migration's pinned contract artifact. The operation inventory comes from this checked-in
baseline, not from whatever routes the server happens to expose. New routes require deliberate
coverage changes. Auth/session tests reuse the same client across genuine backend restarts.

Failures leave pytest's temporary `backend.log` for local diagnosis. Services are stopped and
sockets closed in fixture teardown even after test failures; no application data is modified.
An interrupted or failed run still writes its partial API report, but does not raise a second
coverage error about tests that never ran. The full successful run still enforces coverage.

Task: https://docs.google.com/document/d/1CqaWyve6LW1tY7ra4lRSYRnQ8I9SzgVkSo-IgYPUaZM

## Queue-driven job completion

The suite also starts a disposable backend with the dev queue adapter. It submits a real JSON
completion file after email-code login for a reserved job, imports multiple SOG/PLY representations,
adopts existing library
objects, copies external sources under UUIDs, checks status/permissions/failures, restarts the
process and retries without duplicate assets. Deleted results stay deleted after replay; unknown
jobs fail before source reads. The default backend still checks that dev routes
are absent. The API success gate covers both always-mounted operations and the two conditional
dev operations from `backend/openapi.dev.json`. All files and messages belong to the test's
private temporary directories. SQS SDK behavior is checked separately by backend tests; live
AWS configuration/acceptance is separate.
