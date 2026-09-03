from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from camera_path.geometry import validate_project
from camera_path.models import (
    CameraKeyframe,
    ChatHistoryMessage,
    ChatResult,
    FollowPathAim,
    LookAtPointAim,
    Project,
    ScenePoint,
    SpeedKeyframe,
    SpiralSegment,
    SplineSegment,
)
from camera_path.service import TrajectoryService

SYSTEM_PROMPT = """You incrementally edit a semantic 3D camera trajectory.
The project state is durable and earlier user/assistant messages are included as context.
Use only supplied deterministic tools and never invent ids. Inspect project state before editing.
Path positions are normalized arc length: 0 is the start and 1 is the end.
Speed keyframes contain metres-per-second values. smoothstep and linear interpolate to the next
key; hold keeps the current value and jumps at the next key.
Camera keyframes either follow the path tangent or look at a scene point. The runtime blends the
two resulting view directions between neighboring keys. Scene points are independent of path
anchors. Prefer incremental create/update/delete operations; do not clear unrelated user work.
Explain every resulting change briefly after the tools finish."""


def _object(properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


ID_PARAMETERS = _object({"id": {"type": "string"}}, ["id"])
INTERPOLATION = {"type": "string", "enum": ["smoothstep", "linear", "hold"]}

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "get_project_state",
        "description": "Read anchors, segments, scene points, speed keys and camera keys.",
        "parameters": _object({}, []),
        "strict": True,
    },
    {
        "type": "function",
        "name": "set_default_speed",
        "description": "Set the constant baseline speed in metres per second.",
        "parameters": _object({"speed": {"type": "number", "exclusiveMinimum": 0}}, ["speed"]),
        "strict": True,
    },
    {
        "type": "function",
        "name": "set_default_camera_aim",
        "description": "Set the camera aim used where the direction graph has no overriding key.",
        "parameters": _object(
            {
                "aim_kind": {"type": "string", "enum": ["follow_path", "look_at_point"]},
                "scene_point_id": {"type": ["string", "null"]},
                "direction": {
                    "type": ["string", "null"],
                    "enum": ["forward", "backward", None],
                },
            },
            ["aim_kind", "scene_point_id", "direction"],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_spline",
        "description": "Append a centripetal Catmull-Rom spline through path anchors.",
        "parameters": _object(
            {
                "anchor_ids": {"type": "array", "items": {"type": "string"}, "minItems": 2},
                "tension": {"type": "number", "minimum": 0, "maximum": 1},
            },
            ["anchor_ids", "tension"],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_spiral",
        "description": "Append a world-up-axis spiral which starts and ends at path anchors.",
        "parameters": _object(
            {
                "start_anchor_id": {"type": "string"},
                "center_anchor_id": {"type": "string"},
                "end_anchor_id": {"type": "string"},
                "turns": {"type": "number", "exclusiveMinimum": 0},
                "direction": {"type": "string", "enum": ["cw", "ccw"]},
                "radial_law": {"type": "string", "enum": ["linear", "smoothstep"]},
                "axial_law": {"type": "string", "enum": ["linear", "smoothstep"]},
            },
            [
                "start_anchor_id",
                "center_anchor_id",
                "end_anchor_id",
                "turns",
                "direction",
                "radial_law",
                "axial_law",
            ],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "delete_segment",
        "description": "Delete one path segment by id.",
        "parameters": ID_PARAMETERS,
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_scene_point",
        "description": "Create a named world-space target which camera keys may look at.",
        "parameters": _object(
            {
                "label": {"type": "string", "minLength": 1},
                "position": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            ["label", "position"],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "update_scene_point",
        "description": "Update the label and/or position of a scene point.",
        "parameters": _object(
            {
                "id": {"type": "string"},
                "label": {"type": ["string", "null"]},
                "position": {
                    "type": ["array", "null"],
                    "items": {"type": "number"},
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
            ["id", "label", "position"],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "delete_scene_point",
        "description": "Delete a scene point and optionally its camera keys.",
        "parameters": _object(
            {"id": {"type": "string"}, "cascade": {"type": "boolean"}}, ["id", "cascade"]
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_speed_keyframe",
        "description": "Add a point to the speed-over-path graph.",
        "parameters": _object(
            {
                "path_position": {"type": "number", "minimum": 0, "maximum": 1},
                "speed": {"type": "number", "exclusiveMinimum": 0},
                "interpolation_to_next": INTERPOLATION,
            },
            ["path_position", "speed", "interpolation_to_next"],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "update_speed_keyframe",
        "description": "Move or change one point on the speed graph.",
        "parameters": _object(
            {
                "id": {"type": "string"},
                "path_position": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                "speed": {"type": ["number", "null"], "exclusiveMinimum": 0},
                "interpolation_to_next": {
                    "type": ["string", "null"],
                    "enum": ["smoothstep", "linear", "hold", None],
                },
            },
            ["id", "path_position", "speed", "interpolation_to_next"],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "delete_speed_keyframe",
        "description": "Delete one point from the speed graph.",
        "parameters": ID_PARAMETERS,
        "strict": True,
    },
    {
        "type": "function",
        "name": "create_camera_keyframe",
        "description": "Add a follow-path or look-at point to the camera direction graph.",
        "parameters": _object(
            {
                "path_position": {"type": "number", "minimum": 0, "maximum": 1},
                "aim_kind": {"type": "string", "enum": ["follow_path", "look_at_point"]},
                "scene_point_id": {"type": ["string", "null"]},
                "direction": {"type": ["string", "null"], "enum": ["forward", "backward", None]},
                "interpolation_to_next": INTERPOLATION,
            },
            [
                "path_position",
                "aim_kind",
                "scene_point_id",
                "direction",
                "interpolation_to_next",
            ],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "update_camera_keyframe",
        "description": "Move or change one point on the camera direction graph.",
        "parameters": _object(
            {
                "id": {"type": "string"},
                "path_position": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                "aim_kind": {
                    "type": ["string", "null"],
                    "enum": ["follow_path", "look_at_point", None],
                },
                "scene_point_id": {"type": ["string", "null"]},
                "direction": {"type": ["string", "null"], "enum": ["forward", "backward", None]},
                "interpolation_to_next": {
                    "type": ["string", "null"],
                    "enum": ["smoothstep", "linear", "hold", None],
                },
            },
            [
                "id",
                "path_position",
                "aim_kind",
                "scene_point_id",
                "direction",
                "interpolation_to_next",
            ],
        ),
        "strict": True,
    },
    {
        "type": "function",
        "name": "delete_camera_keyframe",
        "description": "Delete one point from the camera direction graph.",
        "parameters": ID_PARAMETERS,
        "strict": True,
    },
]


class AgentUnavailableError(RuntimeError):
    pass


class TrajectoryAgent:
    def __init__(self, service: TrajectoryService, model: str, api_key: str | None = None) -> None:
        self.service = service
        self.model = model
        self.api_key = api_key

    def ensure_available(self) -> None:
        if not self.api_key:
            raise AgentUnavailableError("OPENAI_API_KEY is not configured")

    async def _finish(
        self, draft: Project, expected_revision: int, message: str, answer: str
    ) -> ChatResult:
        draft.chat_history.extend(
            [
                ChatHistoryMessage(role="user", content=message),
                ChatHistoryMessage(role="assistant", content=answer),
            ]
        )
        draft = await self.service.commit_draft(draft, expected_revision)
        return ChatResult(
            answer=answer,
            project=draft,
            compiled=self.service.compile_draft(draft),
        )

    @classmethod
    def _try_execute(
        cls, draft: Project, name: str, raw_arguments: str
    ) -> tuple[Project, dict[str, Any]]:
        candidate = draft.model_copy(deep=True)
        try:
            arguments = json.loads(raw_arguments)
            output = cls._execute(candidate, name, arguments)
        except (KeyError, TypeError, ValueError) as error:
            return draft, {"status": "error", "error": str(error)}
        return candidate, output

    async def handle(self, project_id: str, message: str) -> ChatResult:
        self.ensure_available()
        draft = await self.service.get_project(project_id)
        expected_revision = draft.revision
        client = AsyncOpenAI(api_key=self.api_key)
        inputs: list[Any] = [item.model_dump() for item in draft.chat_history]
        inputs.append({"role": "user", "content": message})

        for _ in range(12):
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
                return await self._finish(draft, expected_revision, message, response.output_text)

            for call in calls:
                draft, output = self._try_execute(draft, call.name, call.arguments)
                inputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": call.call_id,
                        "output": json.dumps(output),
                    }
                )
        raise RuntimeError("agent exceeded the maximum number of tool-call rounds")

    async def handle_stream(self, project_id: str, message: str) -> AsyncIterator[dict[str, Any]]:
        self.ensure_available()
        draft = await self.service.get_project(project_id)
        expected_revision = draft.revision
        client = AsyncOpenAI(api_key=self.api_key)
        inputs: list[Any] = [item.model_dump() for item in draft.chat_history]
        inputs.append({"role": "user", "content": message})
        answer_parts: list[str] = []

        for _ in range(12):
            round_start = len(answer_parts)
            stream = await client.responses.create(
                model=self.model,
                instructions=SYSTEM_PROMPT,
                tools=TOOLS,
                input=inputs,
                parallel_tool_calls=False,
                stream=True,
            )
            response = None
            async for event in stream:
                if event.type == "response.output_text.delta":
                    answer_parts.append(event.delta)
                    yield {"type": "delta", "text": event.delta}
                elif event.type == "response.completed":
                    response = event.response
            if response is None:
                raise RuntimeError("stream ended without a completed response")
            if len(answer_parts) == round_start and response.output_text:
                answer_parts.append(response.output_text)
                yield {"type": "delta", "text": response.output_text}

            inputs.extend(response.output)
            calls = [item for item in response.output if item.type == "function_call"]
            if not calls:
                result = await self._finish(
                    draft, expected_revision, message, "".join(answer_parts)
                )
                yield {"type": "result", "result": result}
                return

            for call in calls:
                draft, output = self._try_execute(draft, call.name, call.arguments)
                inputs.append(
                    {
                        "type": "function_call_output",
                        "call_id": call.call_id,
                        "output": json.dumps(output),
                    }
                )
        raise RuntimeError("agent exceeded the maximum number of tool-call rounds")

    @staticmethod
    def _aim(arguments: dict[str, Any]) -> FollowPathAim | LookAtPointAim:
        if arguments["aim_kind"] == "look_at_point":
            if not arguments.get("scene_point_id"):
                raise ValueError("scene_point_id is required for look_at_point")
            return LookAtPointAim(scene_point_id=arguments["scene_point_id"])
        return FollowPathAim(direction=arguments.get("direction") or "forward")

    @classmethod
    def _execute(cls, draft: Project, name: str, arguments: dict[str, Any]) -> Any:
        if name == "get_project_state":
            return {
                "anchors": [item.model_dump() for item in draft.anchors.values()],
                "segments": [item.model_dump() for item in draft.segments],
                "scene_points": [item.model_dump() for item in draft.scene_points.values()],
                "motion_profile": draft.motion_profile.model_dump(),
                "camera_track": draft.camera_track.model_dump(),
            }
        if name == "set_default_speed":
            draft.motion_profile.default_speed = arguments["speed"]
            item = draft.motion_profile
        elif name == "set_default_camera_aim":
            draft.camera_track.default_aim = cls._aim(arguments)
            item = draft.camera_track
        elif name == "create_spline":
            item = SplineSegment(**arguments)
            draft.segments.append(item)
        elif name == "create_spiral":
            item = SpiralSegment(**arguments)
            draft.segments.append(item)
        elif name == "delete_segment":
            item = cls._delete_list_item(draft.segments, arguments["id"], "segment")
        elif name == "create_scene_point":
            item = ScenePoint(**arguments)
            draft.scene_points[item.id] = item
        elif name == "update_scene_point":
            item = cls._update_dict_item(draft.scene_points, arguments, "scene point")
        elif name == "delete_scene_point":
            item = cls._delete_scene_point(draft, arguments["id"], arguments["cascade"])
        elif name == "create_speed_keyframe":
            item = SpeedKeyframe(**arguments)
            draft.motion_profile.keyframes[item.id] = item
        elif name == "update_speed_keyframe":
            item = cls._update_dict_item(
                draft.motion_profile.keyframes, arguments, "speed keyframe"
            )
        elif name == "delete_speed_keyframe":
            item = cls._delete_dict_item(
                draft.motion_profile.keyframes, arguments["id"], "speed keyframe"
            )
        elif name == "create_camera_keyframe":
            item = CameraKeyframe(
                path_position=arguments["path_position"],
                aim=cls._aim(arguments),
                interpolation_to_next=arguments["interpolation_to_next"],
            )
            draft.camera_track.keyframes[item.id] = item
        elif name == "update_camera_keyframe":
            patch = {
                key: value
                for key, value in arguments.items()
                if key in {"path_position", "interpolation_to_next"} and value is not None
            }
            if arguments["aim_kind"] is not None:
                patch["aim"] = cls._aim(arguments)
            item = cls._update_dict_item(
                draft.camera_track.keyframes,
                {"id": arguments["id"], **patch},
                "camera keyframe",
            )
        elif name == "delete_camera_keyframe":
            item = cls._delete_dict_item(
                draft.camera_track.keyframes, arguments["id"], "camera keyframe"
            )
        else:
            raise ValueError(f"unknown tool: {name}")
        validate_project(draft)
        return {"id": getattr(item, "id", None), "status": "ok"}

    @staticmethod
    def _update_dict_item(items: dict[str, Any], arguments: dict[str, Any], label: str) -> Any:
        item_id = arguments["id"]
        if item_id not in items:
            raise KeyError(f"{label} {item_id} not found")
        patch = {
            key: value for key, value in arguments.items() if key != "id" and value is not None
        }
        old = items[item_id]
        items[item_id] = old.__class__.model_validate({**old.model_dump(), **patch})
        return items[item_id]

    @staticmethod
    def _delete_dict_item(items: dict[str, Any], item_id: str, label: str) -> Any:
        if item_id not in items:
            raise KeyError(f"{label} {item_id} not found")
        return items.pop(item_id)

    @staticmethod
    def _delete_list_item(items: list[Any], item_id: str, label: str) -> Any:
        for index, item in enumerate(items):
            if item.id == item_id:
                return items.pop(index)
        raise KeyError(f"{label} {item_id} not found")

    @classmethod
    def _delete_scene_point(cls, draft: Any, item_id: str, cascade: bool) -> Any:
        if item_id not in draft.scene_points:
            raise KeyError(f"scene point {item_id} not found")
        if (
            isinstance(draft.camera_track.default_aim, LookAtPointAim)
            and draft.camera_track.default_aim.scene_point_id == item_id
        ):
            raise ValueError(f"scene point {item_id} is used by the default camera aim")
        references = [
            item.id
            for item in draft.camera_track.keyframes.values()
            if isinstance(item.aim, LookAtPointAim) and item.aim.scene_point_id == item_id
        ]
        if references and not cascade:
            raise ValueError(f"scene point {item_id} is used by camera keyframes {references}")
        for keyframe_id in references:
            del draft.camera_track.keyframes[keyframe_id]
        return draft.scene_points.pop(item_id)
