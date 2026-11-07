"""Default generation labels; original image labels retain their file extension."""

from pathlib import PurePosixPath


def text_generation_name(prompt: str) -> str:
    return "_".join(prompt.split()[:5])[:200]


def image_generation_name(filename: str) -> str:
    return PurePosixPath(filename).stem.strip()[:200] or "image"
