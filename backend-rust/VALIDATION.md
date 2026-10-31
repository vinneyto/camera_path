# CP-119 validation

Local environment: macOS/arm64, Rust 1.99.0. Tests use temporary application data.
No live AWS services or production deployment were used.

| Check | Observed result |
| --- | --- |
| Unchanged CP-118 suite against native Rust | 92 passed; one slow timer scenario skipped in the fast run |
| Separate real SMTP resend/expiry scenario | 1 passed, 365 seconds; no clock override |
| SQLite adoption, rollback/read compatibility, schema refusal, historical HTTP, streamed files and providers | 9 passed |
| Numerical reference comparison | 10 Python scenes matched to absolute tolerance 1e-5 |
| Rust unit/workspace/doc checks | Passed; includes SQLite URL compatibility and numerical reference tests |
| Core dependency graph | No AWS SDK/config, broker/HTTP client or concrete adapter dependency |
| All-feature Clippy, formatting and Python tool lint | Passed |
| Infrastructure TypeScript checks | Build passed, 34 tests passed |
| Infrastructure release/rollback checks | 24 Python tests passed |

The provider checks use real RabbitMQ and Moto for SQS/S3/SES. They intercept AMQP Basic.Ack
and fail SQS DeleteMessage after the application commit, then restart and verify no duplicate
business update. S3 checks cover promotion, reuse of an old upload URL and cleanup; SES checks
inspect a successfully accepted provider message and verify its code through the backend API.
These do not establish live AWS IAM, DNS/TLS, SES inbox delivery or production release success.

The migration check populates the Python backend through its real API and real SMTP flow,
stops it, copies SQLite and library files, migrates the copy, compares resources/revisions/IDs
and Python-issued authentication in Rust, changes an anchor in Rust, then starts Python against
the Rust-written copy and verifies Rust-issued authentication and further editing.

The ordinary HTTP suite is intentionally not a proof of frontend rendering, browser disconnect
cancellation, LLM quality or every numerical input. The pinned numerical cases add explicit
coverage beyond its straight-line trajectory scenario. See README.md for exact commands.
