# Painter: local 2D image jobs

> Use the [Camera Path CLI](../README.md#local-development) for new local
> inference setups. Standalone RabbitMQ instructions below are for legacy
> compatibility and draining an existing deployment only.

Independent RabbitMQ worker for transparent PNG generation and editing. It uses
FLUX.2 klein **4B** (Apache-2.0) and U²-Net background removal. The backend owns
jobs, the library and command pipelines. Painter never calls the backend or the
3D worker; image bytes stay in shared local storage, outside RabbitMQ messages.

## Development setup

On an Apple Silicon Mac, run **Dev Setup** from the repository root and accept
its separate Painter prompt. Setup creates `painter/.venv`, prepares missing
weights, selects Painter in `backend/.env`, and aligns the per-clone queues and
output directory. **Dev Start** starts it in a separate **Dev Painter** terminal.
Individual tasks can be stopped or restarted independently. The first setup
needs about 16 GB for FLUX weights, plus the Python environment and U²-Net.

For manual installation from the repository root:

```sh
cp painter/.env.example painter/.env
uv sync --frozen --project painter --extra inference --python 3.12
painter/.venv/bin/python painter/scripts/prepare_model.py
painter/.venv/bin/python -m camera_path_painter
```

The preparation command downloads missing weights at the pinned revision and
writes `painter.json` under `PAINTER_MODEL_DIR`. Weights remain in the Hugging
Face cache; U²-Net uses the rembg cache. Keep those caches after setup. Normal
inference uses local files only. Model execution defaults to MPS/BF16; this path
has been tested on an M4 Mac with 48 GB unified memory.

The worker reads `painter/.env` when launched from the repository root or from
`painter/`; existing environment variables take precedence. Paths expand `~`.

```dotenv
PAINTER_MODEL_DIR=~/.camera-path/models/flux2-klein-4b
PAINTER_OUTPUT_DIR=~/.camera-path/painter
PAINTER_DEVICE=mps
PAINTER_UNLOAD_AFTER_JOB=1
PAINTER_AMQP_URL=amqp://guest:guest@127.0.0.1:5672/
PAINTER_REQUEST_QUEUE=camera-path.painter.requests
PAINTER_RESULT_QUEUE=camera-path.painter.results
HF_HUB_OFFLINE=1
```

`PAINTER_UNLOAD_AFTER_JOB=1` releases the pipeline and MPS cache between jobs so
TRELLIS can use the same Mac. Set it to `0` to retain the model for repeated
2D jobs when memory permits. The worker processes one job at a time. Transparent
editing inputs are composited on white before FLUX; the generated result goes
through background removal and is validated as a nonempty transparent PNG.

## Backend connection

Set these values in `backend/.env`, using the same queues and directory as the
worker. Prefer **Dev Setup**, which assigns isolated queue names for each clone.

```dotenv
CAMERA_PATH_MESSAGE_QUEUE=rabbitmq
CAMERA_PATH_IMAGE_GENERATION_PROVIDER=painter
CAMERA_PATH_PAINTER_OUTPUT_DIRECTORY=~/.camera-path/painter
CAMERA_PATH_PAINTER_REQUEST_QUEUE=camera-path.painter.requests
CAMERA_PATH_PAINTER_RESULT_QUEUE=camera-path.painter.results
```

`CAMERA_PATH_RABBITMQ_URL` must address the same broker as `PAINTER_AMQP_URL`.
Restart the backend after changing providers. Select **Text to 2D image** on
`/jobs/new`, or ask the chat agent to generate or edit an image. Provider choice,
model revision, seed and inference settings are captured in each job. Existing
jobs keep that choice when the configuration changes.

To use OpenAI instead, set `CAMERA_PATH_IMAGE_GENERATION_PROVIDER=openai`,
`OPENAI_API_KEY` and optionally `CAMERA_PATH_OPENAI_IMAGE_MODEL` in the backend.
No Painter worker is needed for OpenAI jobs. A configured Dev Painter task
keeps serving earlier Painter jobs even after switching the default provider.
`none` disables new 2D generation.

Jobs created from the Jobs page publish their result to the library. Image
versions created by chat stay hidden until the user chooses a version. That
choice starts a separate publish → 3D generation → placement pipeline; simply
finishing a 2D job does not start TRELLIS.

## Standalone terminal check

Use **dedicated queues**, with a separate worker instance using those same names.
Do not consume the backend's result queue with this example: consumers compete.
Start RabbitMQ first (`./scripts/dev.sh infrastructure`). In terminal one:

```sh
PAINTER_REQUEST_QUEUE=camera-path.painter.manual.requests \
PAINTER_RESULT_QUEUE=camera-path.painter.manual.results \
  painter/.venv/bin/python -m camera_path_painter
```

In terminal two:

```sh
painter/.venv/bin/python painter/examples/request.py "A small wooden chair" \
  --request-queue camera-path.painter.manual.requests \
  --result-queue camera-path.painter.manual.results
```

Add `--image /absolute/path/reference.png` to edit an image, and `--seed 42` for
a repeatable seed. Responses report `running`, then `succeeded` with a relative
`<job_id>/result.json` path, or `failed` with an error code and message. The
manifest contains the frozen input, `<job_id>/image.png`, byte size and SHA-256.
The backend validates that manifest and copies the PNG into library storage.

Output is published through an atomic directory rename. Re-delivering the same
job/input reuses its verified result; reusing an ID with different input fails.
Acknowledgement follows confirmed result publication. Failed attempts leave no
partial result directory.

## Tests

The normal tests need no model weights or ML dependencies:

```sh
uv sync --frozen --project painter
painter/.venv/bin/python -m unittest discover -s painter/tests -v
```

Backend tests cover provider snapshots, PNG import, input deletion locks,
OpenAI recovery without automatic re-billing, hidden chat versions and job APIs.
