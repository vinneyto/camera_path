# Trellis generation worker

The worker runs the local Apple Silicon Trellis text/image-to-3D port as a separate
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

### Download model weights

From `generation/`, download the text model, its shared Gaussian decoders and
the CLIP text encoder from Hugging Face.

```bash
HF_HUB_OFFLINE=0 .venv/bin/python scripts/prepare_model.py
HF_HUB_OFFLINE=0 .venv/bin/python scripts/prepare_model.py --mode image
```

The text command downloads about 2.7 GB on an empty Hugging Face cache. The image
command downloads its additional models and encoders. Both reuse cached files on
later runs, write a `pipeline.json` with local paths and print the setting for `.env`.

```dotenv
GENERATION_MODEL_DIR=~/.camera-path/models/trellis-text-base
GENERATION_IMAGE_MODEL_DIR=~/.camera-path/models/trellis-image-large
```

The image command prepares the image flow models, shared Gaussian decoders, DINOv2
encoder source/weights and U2Net background removal weights. It reuses the Hugging Face,
Torch and rembg caches. Dev Setup runs both preparation commands when Trellis is enabled.

Use `--model-dir` to put the config in another directory. Trellis checkpoints stay
in the Hugging Face cache; encoder/background paths point to their prepared caches. Keep `HF_HUB_OFFLINE=1` in `.env` for worker runs.
If you already have a prepared model, point `GENERATION_MODEL_DIR` to that
directory. The default output directory is `~/.camera-path/generation`.
Remove any previous `GENERATION_TRELLIS_PORT_DIR` setting to use the checkout
beside `.env`.

### Start the worker

Start RabbitMQ and the worker from `generation/`.

```bash
docker compose -f ../backend/compose.yaml up -d --wait rabbitmq
.venv/bin/python -m camera_path_generation
```

Command-line flags override environment variables, which override the file.
The worker loads the required pipeline on its first request and releases the previous
pipeline when switching between text and image jobs. Image encoder and background removal
use prepared local files, so worker runs do not download dependencies. To run from the Jobs form,
see the [backend configuration](../backend/README.md#queued-job-completion-and-multiple-representations).

### Verify from the terminal

For a standalone check, start a worker from `generation/` with dedicated queues.
Use queue names distinct from the backend's, so it cannot consume the test client's replies.

```bash
.venv/bin/python -m camera_path_generation \
  --request-queue camera-path.generation.smoke.requests \
  --result-queue camera-path.generation.smoke.results
```

In another terminal, submit one request at a time from `generation/` using the same
queue names. If the worker uses a custom broker URL, export the same
`GENERATION_AMQP_URL` in the client terminal. The example client reads this variable
from the shell environment.

```bash
.venv/bin/python examples/request.py "A small wooden chair." \
  --request-queue camera-path.generation.smoke.requests \
  --result-queue camera-path.generation.smoke.results
.venv/bin/python examples/request.py "" \
  --request-queue camera-path.generation.smoke.requests \
  --result-queue camera-path.generation.smoke.results
```

For an image, submit an absolute local path visible to the worker:

```bash
.venv/bin/python examples/request.py --image /absolute/path/source.jpg \
  --request-queue camera-path.generation.smoke.requests \
  --result-queue camera-path.generation.smoke.results
```

The first request should return `succeeded` and a relative `result_path`.
Read that JSON under the output directory to find the PLY path and its
axis-aligned bounding box. The second should return `failed` with code
`invalid_request`. Use `--job-id` to replay the same request. A saved result
with the same UUID and input is reused. Reusing a UUID with different parameters returns `job_conflict`.

## Queue messages

Requests are UTF-8 JSON with `schema_version`, `job_id` and `input.prompt`.

```json
{
  "schema_version": 1,
  "job_id": "784ac98f-e83d-444d-a12a-7ab7ec5c4ec9",
  "input": { "prompt": "A small wooden chair." }
}
```

Image requests replace `input.prompt` with `input.image_path` (an absolute path)
and `input.image_sha256` (the SHA-256 of the original file). The worker verifies the
bytes before generation. The backend stores only `image_asset_id` in the job, resolves
it and stages the original under `GENERATION_OUTPUT_DIR/inputs/<job-id>/` before dispatch.
The worker does not query the asset database. Staged inputs and generated results live
in the producer output directory; removing a library asset removes its library copy.

The UI accepts one PNG, JPEG or WebP up to 20 MB / 40 megapixels. It saves original bytes
in the library. Trellis uses an existing alpha channel, or U2Net to remove an opaque
background during preprocessing. EXIF orientation is applied for generation.

The worker publishes a JSON event with the same job ID and AMQP correlation ID.
A progress event with `status: "running"` is emitted when a valid request starts processing.
It has no result path or error. Consumers must keep waiting for the terminal result;
the example request client handles this automatically.
A successful event has `status: "succeeded"` and `result_path`. A failed event
has `status: "failed"` and an `error` object with `code` and `message`. Requests
without a readable UUID receive a null `job_id`. The worker acknowledges the
request after the broker confirms the result publication. Consumers should
accept duplicate events after a lost acknowledgement.

The result JSON contains the job ID, input, relative file paths and `bbox` with
`min` and `max` XYZ coordinates of the exported Gaussian centers. The worker
publishes the PLY and result JSON together under a directory named for the job
UUID.

## Contract tests

```bash
.venv/bin/python -m unittest discover -s tests
```

These tests cover text compatibility, image checksums, replay and conflicting job IDs.
They run in GitHub Actions without model weights or an MPS device.
