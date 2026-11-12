"""Closed command registry; references are data, never executable expressions."""

import json
from copy import deepcopy

from jsonschema import Draft202012Validator

REF = {
    "type": "object",
    "properties": {"$ref": {"type": "string", "pattern": r"^[A-Za-z][\w-]*\.[\w.]+$"}},
    "required": ["$ref"],
    "additionalProperties": False,
}
STR = {"type": "string", "minLength": 1}
OPTIONAL_STR = {"type": ["string", "null"]}


def command_schemas():
    # Lazy imports keep the agent and deterministic executor independent at import time.
    from camera_path.agent.scene_tools import SCENE_TOOLS
    from camera_path.agent.trajectory_agent import TOOLS

    omitted = {
        "get_project_state",
        "list_library_assets",
        "get_generation_job",
        "start_image_generation",
    }
    schemas = {
        t["name"]: deepcopy(t["parameters"])
        for t in TOOLS + SCENE_TOOLS
        if t["name"] not in omitted
    }

    def obj(props, required):
        return {
            "type": "object",
            "properties": props,
            "required": required,
            "additionalProperties": False,
        }

    schemas["publish_chat_image"] = obj({"attachment_id": STR}, ["attachment_id"])
    schemas["generate_image"] = obj(
        {
            "prompt": STR,
            "source_attachment_id": OPTIONAL_STR,
            "name": OPTIONAL_STR,
            "anchor_id": OPTIONAL_STR,
        },
        ["prompt"],
    )
    schemas["generate_model"] = obj(
        {
            "prompt": OPTIONAL_STR,
            "image_asset_id": {
                **OPTIONAL_STR,
                "description": (
                    "Ready library image ID from publish_chat_image. "
                    "Chat attachments must be published first."
                ),
            },
            "name": OPTIONAL_STR,
        },
        [],
    )
    placement = {
        "library_asset_id": STR,
        "anchor_id": OPTIONAL_STR,
        "fit_to_anchor": {"type": "boolean"},
        "replace_anchor": {"type": "boolean"},
    }
    schemas["place_model"] = obj(placement, ["library_asset_id"])
    schemas["replace_anchor_with_asset"]["properties"]["fit_to_anchor"] = {"type": "boolean"}
    return schemas


def references(value):
    if isinstance(value, dict):
        if set(value) == {"$ref"}:
            yield value["$ref"]
        else:
            for item in value.values():
                yield from references(item)
    elif isinstance(value, list):
        for item in value:
            yield from references(item)


def with_references(schema, *, root=False):
    value = deepcopy(schema)
    if "properties" in value:
        value["properties"] = {k: with_references(v) for k, v in value["properties"].items()}
    if "items" in value:
        value["items"] = with_references(value["items"])
    return value if root else {"anyOf": [value, REF]}


def validate_definition(definition):
    if len(json.dumps(definition.model_dump(mode="json"), allow_nan=False).encode()) > 256 * 1024:
        raise ValueError("Pipeline definition exceeds 256 KiB")
    schemas = command_schemas()
    previous = set()
    for step in definition.steps:
        if step.id in previous:
            raise ValueError(f"Duplicate step ID: {step.id}")
        if step.command not in schemas:
            raise ValueError(f"Unsupported command: {step.command}")
        if (
            step.command == "generate_model"
            and sum(step.input.get(k) is not None for k in ("prompt", "image_asset_id")) != 1
        ):
            raise ValueError("generate_model requires exactly one of prompt and image_asset_id")
        Draft202012Validator(with_references(schemas[step.command], root=True)).validate(step.input)
        for ref in references(step.input):
            if ref.split(".", 1)[0] not in previous:
                raise ValueError(f"Reference must point to an earlier step: {ref}")
        previous.add(step.id)


def resolve_input(value, outputs):
    if isinstance(value, dict):
        if set(value) == {"$ref"}:
            path = value["$ref"].split(".")
            result = outputs
            for key in path:
                if not isinstance(result, dict) or key not in result:
                    raise ValueError(f"Missing step output: {value['$ref']}")
                result = result[key]
            return result
        return {k: resolve_input(v, outputs) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve_input(v, outputs) for v in value]
    return value


def agent_pipeline_tools():
    def strict(schema):
        result = deepcopy(schema)
        if "properties" in result:
            result["required"] = list(result["properties"])
            result["properties"] = {k: strict(v) for k, v in result["properties"].items()}
        if "items" in result:
            result["items"] = strict(result["items"])
        if "anyOf" in result:
            result["anyOf"] = [strict(v) for v in result["anyOf"]]
        return result

    items = []
    for name, schema in command_schemas().items():
        items.append(
            {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "pattern": r"^[A-Za-z][A-Za-z0-9_-]{0,63}$"},
                    "command": {"type": "string", "enum": [name]},
                    "input": with_references(schema, root=True),
                },
                "required": ["id", "command", "input"],
                "additionalProperties": False,
            }
        )
    definition = {
        "type": "object",
        "properties": {
            "schema_version": {"type": "integer", "enum": [1]},
            "title": {"type": "string"},
            "start_mode": {"type": "string", "enum": ["auto", "wait_for_confirmation"]},
            "steps": {"type": "array", "minItems": 1, "maxItems": 32, "items": {"anyOf": items}},
        },
        "required": ["schema_version", "title", "start_mode", "steps"],
        "additionalProperties": False,
    }
    return [
        {
            "type": "function",
            "name": "submit_pipeline",
            "description": (
                "Save a visible linear command pipeline and start it automatically unless the user "
                "asked to wait. Use $ref objects for earlier step outputs. Execution continues "
                "without you; never poll. Even one mutation must use a pipeline."
            ),
            "parameters": strict(
                {
                    "type": "object",
                    "properties": {"definition": definition},
                    "required": ["definition"],
                    "additionalProperties": False,
                }
            ),
            "strict": True,
        },
        *[
            {
                "type": "function",
                "name": name,
                "description": description,
                "parameters": {
                    "type": "object",
                    "properties": {"pipeline_id": STR},
                    "required": ["pipeline_id"],
                    "additionalProperties": False,
                },
                "strict": True,
            }
            for name, description in [
                ("get_pipeline", "Read one persisted execution report."),
                ("confirm_pipeline", "Start the exact pending pipeline the user approved."),
            ]
        ],
    ]
