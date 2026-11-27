"""File-based requests for painter; jobs remain the application contract."""

from typing import Annotated

from pydantic import Field, StrictInt, field_validator, model_validator

from camera_path.services.generation_models import Version
from camera_path.services.job_completion_models import MessageModel
from camera_path.services.library_metadata import canonical_uuid, relative_key

PAINTER_MODEL = "black-forest-labs/FLUX.2-klein-4B"
PAINTER_REVISION = "e7b7dc27f91deacad38e78976d1f2b499d76a294"


class ImageWorkerInput(MessageModel):
    prompt: str = Field(min_length=1, max_length=16000, pattern=r"\S")
    model: str = PAINTER_MODEL
    revision: str = PAINTER_REVISION
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
        if self.width % 16 or self.height % 16:
            raise ValueError("Image dimensions must be multiples of 16")
        return self


class ImageGenerationRequest(MessageModel):
    schema_version: Version = 1
    job_id: str
    input: ImageWorkerInput

    _job_id = field_validator("job_id")(canonical_uuid)


class ImageGenerationManifest(MessageModel):
    schema_version: Version
    job_id: str
    input: ImageWorkerInput
    image_path: str
    size_bytes: Annotated[StrictInt, Field(gt=0, le=20 * 1024**2)]
    sha256: str = Field(pattern="^[0-9a-f]{64}$")

    _job_id = field_validator("job_id")(canonical_uuid)

    @model_validator(mode="after")
    def validate_path(self):
        if relative_key(self.image_path) != f"{self.job_id}/image.png":
            raise ValueError("Expected the generated PNG in this job's directory")
        return self
