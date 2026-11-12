"""Versioned, linear command definitions and their durable execution reports."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PipelineStep(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")
    command: str
    input: dict[str, Any]


class PipelineDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    title: str = Field(min_length=1, max_length=200)
    start_mode: Literal["auto", "wait_for_confirmation"] = "auto"
    steps: list[PipelineStep] = Field(min_length=1, max_length=32)


class PipelineStepRun(BaseModel):
    id: str
    status: Literal["pending", "running", "waiting", "succeeded", "failed"] = "pending"
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    error: dict[str, str] | None = None
    started_at: str | None = None
    completed_at: str | None = None
    job_id: str | None = None
    phase: str | None = None


class Pipeline(BaseModel):
    id: str
    project_id: str
    message_id: str
    definition: PipelineDefinition
    status: Literal["awaiting_confirmation", "queued", "running", "succeeded", "failed"]
    steps: list[PipelineStepRun]
    created_at: datetime
    updated_at: datetime
    version: int


class PipelineCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message_id: str = Field(min_length=1, max_length=128)
    definition: PipelineDefinition
