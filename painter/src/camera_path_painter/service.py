import hashlib
import json
import logging
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated
from uuid import UUID

from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 256 * 1024
MAX_IMAGE_BYTES = 20 * 1024**2
MODEL = "black-forest-labs/FLUX.2-klein-4B"
REVISION = "e7b7dc27f91deacad38e78976d1f2b499d76a294"


class ImageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: str = Field(min_length=1, max_length=16000, pattern=r"\S")
    model: str = MODEL
    revision: str = REVISION
    seed: Annotated[StrictInt, Field(ge=0, le=2**32 - 1)]
    width: Annotated[StrictInt, Field(ge=256, le=2048)] = 1024
    height: Annotated[StrictInt, Field(ge=256, le=2048)] = 1024
    steps: Annotated[StrictInt, Field(ge=1, le=50)] = 4
    image_path: str | None = None
    image_sha256: str | None = Field(default=None, pattern="^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def validate_source(self):
        if bool(self.image_path) != bool(self.image_sha256):
            raise ValueError("Source image needs both path and checksum")
        if self.image_path and not Path(self.image_path).is_absolute():
            raise ValueError("Source image path must be absolute")
        if self.width % 16 or self.height % 16:
            raise ValueError("Image dimensions must be multiples of 16")
        return self


class ImageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Annotated[StrictInt, Field(ge=1, le=1)]
    job_id: UUID
    input: ImageInput


def validate_png(path):
    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError("Generated image exceeds size limit")
    with Image.open(path) as image:
        if image.format != "PNG" or image.width * image.height > 40_000_000:
            raise ValueError("Expected a PNG within the size limit")
        image.load()
        low, high = image.convert("RGBA").getchannel("A").getextrema()
        if low == 255 or high == 0:
            raise ValueError("Expected a subject and transparent background")


class JobConflictError(ValueError):
    pass


class PainterService:
    def __init__(self, output_dir, generate):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.generate = generate

    def process(self, body):
        job_id = None
        try:
            if len(body) > MAX_REQUEST_BYTES:
                raise ValueError("Request too large")
            payload = json.loads(body)
            if isinstance(payload, dict) and isinstance(payload.get("job_id"), str):
                job_id = str(UUID(payload["job_id"]))
            request = ImageRequest.model_validate(payload)
        except (ValueError, RecursionError):
            return {
                "schema_version": 1,
                "job_id": job_id,
                "status": "failed",
                "error": {
                    "code": "invalid_request",
                    "message": "Expected a valid image request",
                },
            }
        job_id = str(request.job_id)
        event = {"schema_version": 1, "job_id": job_id}
        try:
            result = self._generate(job_id, request.input)
        except JobConflictError:
            return {
                **event,
                "status": "failed",
                "error": {
                    "code": "job_conflict",
                    "message": "Job ID already has another input",
                },
            }
        except Exception:
            logger.exception("Painter failed for job %s", job_id)
            return {
                **event,
                "status": "failed",
                "error": {
                    "code": "image_generation_failed",
                    "message": "Local image generation failed",
                },
            }
        return {**event, "status": "succeeded", "result_path": result}

    @staticmethod
    def _existing(target, job_id, parameters):
        manifest = json.loads((target / "result.json").read_text())
        if manifest["job_id"] != job_id or manifest["input"] != parameters.model_dump():
            raise JobConflictError
        image = target / "image.png"
        validate_png(image)
        raw = image.read_bytes()
        if (
            len(raw) != manifest["size_bytes"]
            or hashlib.sha256(raw).hexdigest() != manifest["sha256"]
        ):
            raise ValueError("Saved result has changed")

    def _generate(self, job_id, parameters):
        target = self.output_dir / job_id
        result_path = f"{job_id}/result.json"
        if target.exists():
            self._existing(target, job_id, parameters)
            return result_path
        if parameters.image_path:
            with Path(parameters.image_path).open("rb") as source:
                raw = source.read(MAX_IMAGE_BYTES + 1)
            if (
                len(raw) > MAX_IMAGE_BYTES
                or hashlib.sha256(raw).hexdigest() != parameters.image_sha256
            ):
                raise ValueError("Source image does not match the request")
        with TemporaryDirectory(prefix=".painter-", dir=self.output_dir) as scratch:
            staged = Path(scratch)
            image = staged / "image.png"
            self.generate(parameters, image)
            validate_png(image)
            raw = image.read_bytes()
            manifest = {
                "schema_version": 1,
                "job_id": job_id,
                "input": parameters.model_dump(),
                "image_path": f"{job_id}/image.png",
                "size_bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
            }
            (staged / "result.json").write_text(
                json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
            )
            try:
                staged.rename(target)
            except OSError:
                if not target.exists():
                    raise
                self._existing(target, job_id, parameters)
        return result_path
