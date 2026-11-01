"""The same versioned payload is used by every queue adapter."""

import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

from camera_path.services.library_metadata import (
    canonical_uuid,
    normalize_tags,
    relative_key,
    validate_thumbnail,
)

FileId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
MAX_MESSAGE_BYTES = 256 * 1024


class MessageModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LibraryFileSource(MessageModel):
    storage: FileId
    path: str

    _path = field_validator("path")(relative_key)


class LibraryImportFile(MessageModel):
    id: FileId
    format: Literal["ply", "sog"]
    size_bytes: Annotated[StrictInt, Field(gt=0, le=2 * 1024**3)]
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    source: LibraryFileSource

    @field_validator("sha256")
    @classmethod
    def lowercase_hash(cls, value: str) -> str:
        return value.lower()


class JobCompletionAsset(MessageModel):
    name: str = Field(min_length=1, max_length=200)
    tags: list[str] = Field(default_factory=list)
    thumbnail_key: str | None = None
    primary_file_id: FileId
    files: list[LibraryImportFile] = Field(min_length=1)

    _tags = field_validator("tags")(normalize_tags)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_item(self):
        validate_thumbnail(self.thumbnail_key)
        ids = [f.id for f in self.files]
        sources = [(f.source.storage, f.source.path) for f in self.files]
        if len(set(ids)) != len(ids) or self.primary_file_id not in ids:
            raise ValueError("Unique file IDs and one existing primary_file_id are required")
        if len(set(sources)) != len(sources):
            raise ValueError("Each file must have a distinct source")
        return self


class JobCompletionMessage(MessageModel):
    schema_version: Annotated[StrictInt, Field(ge=2, le=2)]
    message_id: str
    job_id: str
    assets: list[JobCompletionAsset] = Field(min_length=1)

    _job_id = field_validator("job_id")(canonical_uuid)
    _message_id = field_validator("message_id")(canonical_uuid)

    @model_validator(mode="after")
    def distinct_results(self):
        sources = [(f.source.storage, f.source.path) for a in self.assets for f in a.files]
        thumbnails = [a.thumbnail_key for a in self.assets if a.thumbnail_key is not None]
        if len(set(sources)) != len(sources) or len(set(thumbnails)) != len(thumbnails):
            raise ValueError("Result files and thumbnails must have distinct sources")
        return self

    def canonical_body(self) -> str:
        return json.dumps(
            self.model_dump(), sort_keys=True, separators=(",", ":"), ensure_ascii=False
        )
