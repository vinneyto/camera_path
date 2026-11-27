"""Primitive descriptions only; geometry is constructed by the client."""

from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field


class ScenePrimitive(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["cube", "sphere", "cone"]
    color: str = Field(default="#60a5fa", pattern=r"^#[0-9a-fA-F]{6}$")


def validate_primitive(value: str) -> str:
    return ScenePrimitive.model_validate_json(value).model_dump_json()


PrimitiveJson = Annotated[str, AfterValidator(validate_primitive)]
