import hashlib
import json
import logging
from collections.abc import Callable
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated
from uuid import UUID

import numpy as np
from plyfile import PlyData
from pydantic import BaseModel, ConfigDict, Field, StrictInt, ValidationError, field_validator

logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 256 * 1024


class TextGenerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str

    @field_validator("prompt")
    @classmethod
    def require_prompt(cls, prompt: str) -> str:
        if not prompt.strip():
            raise ValueError("Prompt is required")
        return prompt


class ImageGenerationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_path: str = Field(min_length=1)
    image_sha256: str = Field(pattern="^[0-9a-f]{64}$")

    @field_validator("image_path")
    @classmethod
    def absolute_path(cls, value: str) -> str:
        if not Path(value).is_absolute():
            raise ValueError("Image path must be absolute")
        return value


GenerationInput = TextGenerationInput | ImageGenerationInput


class GenerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Annotated[StrictInt, Field(ge=1, le=1)]
    job_id: UUID
    input: GenerationInput


class JobConflictError(Exception):
    """A request reused a job ID with different generation parameters."""


class GenerationService:
    def __init__(self, output_dir: Path, generate_ply: Callable[[GenerationInput, Path], None]):
        self.output_dir = output_dir
        self.generate_ply = generate_ply
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def process(self, body: bytes) -> dict:
        event = {"schema_version": 1, "job_id": None}
        try:
            if len(body) > MAX_REQUEST_BYTES:
                raise ValueError("Request exceeds the size limit")
            payload = json.loads(body)
            if isinstance(payload, dict):
                raw_job_id = payload.get("job_id")
                if isinstance(raw_job_id, str):
                    event["job_id"] = str(UUID(raw_job_id))
            request = GenerationRequest.model_validate(payload)
        except (ValueError, RecursionError) as error:
            if isinstance(error, ValidationError):
                issue = error.errors(include_url=False, include_context=False, include_input=False)[
                    0
                ]
                message = f"{'.'.join(map(str, issue['loc']))}: {issue['msg']}".strip(": ")
            else:
                message = "Expected a JSON generation request with a valid job ID."
            return {
                **event,
                "status": "failed",
                "error": {"code": "invalid_request", "message": message},
            }

        job_id = str(request.job_id)
        event["job_id"] = job_id
        try:
            result_path = self._generate(job_id, request.input)
        except JobConflictError:
            return {
                **event,
                "status": "failed",
                "error": {"code": "job_conflict", "message": "Job ID already has another input."},
            }
        except Exception:
            logger.exception("Generation failed for job %s", job_id)
            return {
                **event,
                "status": "failed",
                "error": {"code": "generation_failed", "message": "Trellis generation failed."},
            }
        return {**event, "status": "succeeded", "result_path": result_path}

    def _generate(self, job_id: str, parameters: GenerationInput) -> str:
        target = self.output_dir / job_id
        result_path = f"{job_id}/result.json"
        if target.exists():
            self._check_existing_result(target, parameters)
            return result_path

        if isinstance(parameters, ImageGenerationInput):
            with Path(parameters.image_path).open("rb") as image:
                data = image.read(20 * 1024**2 + 1)
            if (
                len(data) > 20 * 1024**2
                or hashlib.sha256(data).hexdigest() != parameters.image_sha256
            ):
                raise ValueError("Source image does not match the request")

        with TemporaryDirectory(prefix=".generation-", dir=self.output_dir) as scratch:
            staged = Path(scratch)
            ply = staged / "asset.ply"
            self.generate_ply(parameters, ply)
            vertices = PlyData.read(ply)["vertex"].data
            if not len(vertices) or not all(
                np.isfinite(vertices[name]).all() for name in vertices.dtype.names
            ):
                raise ValueError("Generated PLY must have finite vertices")
            bbox = {
                "min": [float(vertices[axis].min()) for axis in "xyz"],
                "max": [float(vertices[axis].max()) for axis in "xyz"],
            }
            result = {
                "schema_version": 1,
                "job_id": job_id,
                "input": parameters.model_dump(),
                "files": [f"{job_id}/asset.ply"],
                "bbox": bbox,
            }
            (staged / "result.json").write_text(
                json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
                encoding="utf-8",
            )
            try:
                staged.rename(target)
            except OSError:
                if not target.exists():
                    raise
                self._check_existing_result(target, parameters)
        return result_path

    @staticmethod
    def _check_existing_result(target: Path, parameters: GenerationInput) -> None:
        result = json.loads((target / "result.json").read_text(encoding="utf-8"))
        if result["input"] != parameters.model_dump():
            raise JobConflictError
        if not (target / "asset.ply").is_file():
            raise FileNotFoundError("Saved generation PLY is missing")
