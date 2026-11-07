"""Contracts exchanged with the standalone generation worker."""

from typing import Annotated, Literal

from pydantic import Field, StrictInt, field_validator, model_validator

from camera_path.services.job_completion_models import MessageModel
from camera_path.services.library_metadata import BoundingBox, canonical_uuid, relative_key

GENERATION_SOURCE = "generation"
Version = Annotated[StrictInt, Field(ge=1, le=1)]


class TextGenerationInput(MessageModel):
    prompt: str = Field(min_length=1, pattern=r"\S")


class ImageGenerationInput(MessageModel):
    image_path: str = Field(min_length=1)
    image_sha256: str = Field(pattern="^[0-9a-f]{64}$")


GenerationInput = TextGenerationInput | ImageGenerationInput


class GenerationRequest(MessageModel):
    schema_version: Version = 1
    job_id: str
    input: GenerationInput


class GenerationError(MessageModel):
    code: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=2048)


class GenerationResult(MessageModel):
    schema_version: Version
    job_id: str
    status: Literal["succeeded", "failed"]
    result_path: str | None = None
    error: GenerationError | None = None

    _job_id = field_validator("job_id")(canonical_uuid)

    @property
    def message_id(self) -> str:
        return self.job_id

    @model_validator(mode="after")
    def validate_result(self):
        if self.status == "succeeded":
            if self.result_path != f"{self.job_id}/result.json" or self.error is not None:
                raise ValueError("Expected a result manifest for this job")
        elif self.result_path is not None or self.error is None:
            raise ValueError("Expected a generation error")
        return self


class GenerationManifest(MessageModel):
    schema_version: Version
    job_id: str
    input: GenerationInput
    files: list[str] = Field(min_length=1, max_length=64)
    bbox: BoundingBox

    _job_id = field_validator("job_id")(canonical_uuid)

    @model_validator(mode="after")
    def validate_files(self):
        if len(set(self.files)) != len(self.files):
            raise ValueError("Expected distinct result files")
        for path in self.files:
            if not relative_key(path).startswith(f"{self.job_id}/"):
                raise ValueError("Expected result files in the job directory")
        return self
