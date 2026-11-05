# Trellis generation worker

The worker runs the local Apple Silicon Trellis text-to-3D port as a separate
process. Its generation code reads JSON and writes files. A RabbitMQ adapter
receives requests and publishes results for local development.

## Run on a Mac

Use the Python environment of a working Trellis Mac port and its prepared
`microsoft/TRELLIS-text-base` model directory. The directory must contain
`pipeline.json` with paths to the local text encoder and checkpoints. The
pipeline must support Gaussian PLY export. Point `TRELLIS_PORT` at the port
checkout and `TRELLIS_PYTHON` at that environment's Python executable. Point
`TRELLIS_MODEL_DIR` at the prepared directory. Run from the repository root.

```bash
docker compose -f backend/compose.yaml up -d rabbitmq
"$TRELLIS_PYTHON" -m pip install -e generation

HF_HUB_OFFLINE=1 PYTHONPATH="$TRELLIS_PORT${PYTHONPATH:+:$PYTHONPATH}" \
  "$TRELLIS_PYTHON" -m camera_path_generation \
  --model-dir "$TRELLIS_MODEL_DIR" --output-dir /tmp/camera-path-generation \
  --request-queue camera-path.smoke.generate --result-queue camera-path.smoke.result
```

The default broker URL is `amqp://guest:guest@127.0.0.1:5672/`. Override it
with `GENERATION_AMQP_URL` in both terminals if needed. The worker loads the
model on the first valid request. The backend process is not needed for this
run.

In another terminal, use dedicated queues and submit one request at a time.

```bash
"$TRELLIS_PYTHON" generation/examples/request.py "A small wooden chair." \
  --request-queue camera-path.smoke.generate --result-queue camera-path.smoke.result

"$TRELLIS_PYTHON" generation/examples/request.py "" \
  --request-queue camera-path.smoke.generate --result-queue camera-path.smoke.result
```

The first request should return `succeeded` and a relative `result_path`.
Read that JSON under the output directory to find the PLY path and its
axis-aligned bounding box. The second should return `failed` with code
`invalid_request`. Use `--job-id` to replay the same request. A saved result
with the same UUID and prompt is reused.

## Queue messages

Requests are UTF-8 JSON with `schema_version`, `job_id` and `input.prompt`.

```json
{
  "schema_version": 1,
  "job_id": "784ac98f-e83d-444d-a12a-7ab7ec5c4ec9",
  "input": { "prompt": "A small wooden chair." }
}
```

The worker publishes a JSON event with the same job ID and AMQP correlation ID.
A successful event has `status: "succeeded"` and `result_path`. A failed event
has `status: "failed"` and an `error` object with `code` and `message`. Requests
without a readable UUID receive a null `job_id`. The worker acknowledges the
request after the broker confirms the result publication. Consumers should
accept duplicate events after a lost acknowledgement.

The result JSON contains the job ID, input, relative file paths and `bbox` with
`min` and `max` XYZ coordinates of the exported Gaussian centers. The worker
publishes the PLY and result JSON together under a directory named for the job
UUID. The backend integration and stop commands are separate work.
