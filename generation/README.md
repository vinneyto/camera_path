# Trellis generation worker

The worker runs the local Apple Silicon Trellis text-to-3D port as a separate
process. Its generation code reads JSON and writes files. A RabbitMQ adapter
receives requests and publishes results for local development.

## Run on a Mac

Set up the worker on Apple Silicon from the repository root. Its Python 3.12
environment and Trellis checkout live under `generation/` and are ignored by
Git. The patch keeps exported Gaussian opacity values finite.

```bash
cd generation
git clone https://github.com/vinayapathak/trellis-mac-mps.git
git -C trellis-mac-mps checkout --detach f7c175a8620c2c23923d5b6fca3bf7f53604335f
git -C trellis-mac-mps apply ../trellis-finite-opacity.patch
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e . -r requirements-trellis-mps.txt
cp -n .env.example .env
```

In `.env`, set `GENERATION_MODEL_DIR` to the prepared `microsoft/TRELLIS-text-base`
model directory containing `pipeline.json` and references to the local text
encoder and checkpoints. The model can live outside the repository. The default
output directory is `~/.camera-path/generation`. Remove any previous
`GENERATION_TRELLIS_PORT_DIR` setting to use the checkout beside `.env`.

Start RabbitMQ and the worker from `generation/`.

```bash
docker compose -f ../backend/compose.yaml up -d --wait rabbitmq
.venv/bin/python -m camera_path_generation
```

Command-line flags override environment variables, which override the file.
The worker loads the model on the first valid request. The backend process is
not needed for this run.

In another terminal, submit one request at a time from `generation/`. If you
changed the broker URL or queues, pass the same values to the client through
`GENERATION_AMQP_URL`, `--request-queue` and `--result-queue`.

```bash
.venv/bin/python examples/request.py "A small wooden chair."
.venv/bin/python examples/request.py ""
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
