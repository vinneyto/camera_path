"""Server-owned input contracts, independent of frontend presets and workers."""

from jsonschema import Draft202012Validator

from camera_path.services.library_metadata import LibraryError

JOB_INPUT_SCHEMAS = {
    "generation": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["prompt"],
        "properties": {"prompt": {"type": "string", "minLength": 1, "pattern": r"\S"}},
        "additionalProperties": False,
    },
}
for schema in JOB_INPUT_SCHEMAS.values():
    Draft202012Validator.check_schema(schema)
INPUT_VALIDATORS = {kind: Draft202012Validator(s) for kind, s in JOB_INPUT_SCHEMAS.items()}


def validate_job_input(kind: str, value: dict) -> None:
    validator = INPUT_VALIDATORS.get(kind)
    if validator is None:
        raise LibraryError(
            "validation_error",
            422,
            [{"location": ["body", "type"], "message": "Unsupported job type", "type": "enum"}],
        )
    errors = [
        {
            "location": ["body", "input", *error.absolute_path],
            "message": error.message,
            "type": f"json_schema.{error.validator}",
        }
        for error in validator.iter_errors(value)
    ]
    if errors:
        raise LibraryError("validation_error", 422, errors)
