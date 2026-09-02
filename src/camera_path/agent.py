from __future__ import annotations

import json
import os
from typing import Any

from openai import AsyncOpenAI

from camera_path.geometry import compile_project, validate_project
from camera_path.models import ChatResult, SpiralSegment, SplineSegment
from camera_path.repository import InMemoryProjectRepository

SYSTEM_PROMPT = """You edit a semantic 3D camera trajectory.
Use only the supplied deterministic tools for geometry. Never invent anchor ids.
A spline needs at least two anchor ids. A spiral uses start, center/axis and end anchors,
plus turns and direction. Inspect anchors before editing. Keep segment order intentional.
Explain the resulting path briefly after the tools finish."""

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "list_anchors",
        "description": "List available anchors and their effective positions.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "clear_segments",
        "description": "Remove every semantic trajectory segment, but keep anchors.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_spline",
        "description": "Append a centripetal Catmull-Rom spline through anchors.",
        "parameters": {
            "type": "object",
            "properties": {
                "anchor_ids": {"type": "array", "items": {"type": "string"}, "minItems": 2},
                "tension": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "required": ["anchor_ids", "tension"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_spiral",
        "description": "Append a world-up-axis spiral that starts and ends exactly at anchors.",
        "parameters": {
            "type": "object",
            "properties": {
                "start_anchor_id": {"type": "string"},
                "center_anchor_id": {"type": "string"},
                "end_anchor_id": {"type": "string"},
                "turns": {"type": "number", "exclusiveMinimum": 0},
                "direction": {"type": "string", "enum": ["cw", "ccw"]},
                "radial_law": {"type": "string", "enum": ["linear", "smoothstep"]},
                "axial_law": {"type": "string", "enum": ["linear", "smoothstep"]},
            },
            "required": [
                "start_anchor_id",
                "center_anchor_id",
                "end_anchor_id",
                "turns",
                "direction",
                "radial_law",
                "axial_law",
            ],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


class AgentUnavailableError(RuntimeError):
    pass


class TrajectoryAgent:
    def __init__(self, repository: InMemoryProjectRepository, model: str) -> None:
        self.repository = repository
        self.model = model

    async def handle(self, project_id: str, message: str) -> ChatResult:
        if not os.getenv("OPENAI_API_KEY"):
            raise AgentUnavailableError("OPENAI_API_KEY is not configured")
        draft = await self.repository.get(project_id)
        expected_revision = draft.revision
        client = AsyncOpenAI()
        inputs: list[Any] = [{"role": "user", "content": message}]
        changed = False

        for _ in range(8):
            response = await client.responses.create(
                model=self.model,
                instructions=SYSTEM_PROMPT,
                tools=TOOLS,
                input=inputs,
                parallel_tool_calls=False,
            )
            inputs.extend(response.output)
            calls = [item for item in response.output if item.type == "function_call"]
            if not calls:
                if changed:
                    validate_project(draft)
                    compile_project(draft)
                    draft = await self.repository.commit(draft, expected_revision)
                return ChatResult(
                    answer=response.output_text, project=draft, compiled=compile_project(draft)
                )

            for call in calls:
                arguments = json.loads(call.arguments)
                output, mutated = self._execute(draft, call.name, arguments)
                changed = changed or mutated
                inputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": call.call_id,
                        "output": json.dumps(output),
                    }
                )
        raise RuntimeError("agent exceeded the maximum number of tool-call rounds")

    @staticmethod
    def _execute(draft: Any, name: str, arguments: dict[str, Any]) -> tuple[Any, bool]:
        if name == "list_anchors":
            return [anchor.model_dump() for anchor in draft.anchors.values()], False
        if name == "clear_segments":
            draft.segments.clear()
            return {"status": "cleared"}, True
        if name == "create_spline":
            segment = SplineSegment(**arguments)
            draft.segments.append(segment)
            validate_project(draft)
            return {"segment_id": segment.id}, True
        if name == "create_spiral":
            segment = SpiralSegment(**arguments)
            draft.segments.append(segment)
            validate_project(draft)
            compiled = compile_project(draft)
            return {"segment_id": segment.id, "total_length": compiled.total_length}, True
        raise ValueError(f"unknown tool: {name}")
