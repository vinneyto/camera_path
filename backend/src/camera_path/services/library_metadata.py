"""Provider-independent validation shared by uploads and import messages."""

import re
import unicodedata
from uuid import UUID


def canonical_uuid(value: str) -> str:
    parsed = UUID(value)
    if not parsed.int:
        raise ValueError("UUID must not be zero")
    return str(parsed)


def normalize_tags(values: list[str]) -> list[str]:
    if len(values) > 20:
        raise ValueError("At most 20 tags are allowed")
    result, seen = [], set()
    for value in values:
        if any(ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValueError("Tags cannot contain control characters")
        tag = " ".join(unicodedata.normalize("NFC", value).split())
        if not 1 <= len(tag) <= 64:
            raise ValueError("Tags must contain 1–64 characters")
        if tag.casefold() not in seen:
            result.append(tag)
            seen.add(tag.casefold())
    return result


def validate_thumbnail(key: str | None, client_id: str | None) -> str | None:
    if key is not None and (
        client_id is None
        or len(key) > 255
        or not re.fullmatch(
            rf"thumbnails/{re.escape(client_id)}/[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpg|jpeg|webp)",
            key,
        )
    ):
        raise ValueError("Thumbnail must belong to the explicit client ID namespace")
    return key


def relative_key(key: str) -> str:
    if (
        not key
        or len(key) > 1024
        or "\\" in key
        or ":" in key
        or any(ord(c) < 32 or ord(c) == 127 for c in key)
        or any(part in {"", ".", ".."} for part in key.split("/"))
    ):
        raise ValueError("Expected a relative storage path")
    return key


class LibraryError(Exception):
    def __init__(self, code: str, status: int = 409, field_errors: list[dict] | None = None):
        self.code, self.status = code, status
        self.field_errors = field_errors
        super().__init__(code)
