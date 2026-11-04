"""Build a completion JSON from finished files; no backend or provider access."""

import argparse
import hashlib
import json
from pathlib import Path
from uuid import UUID, uuid4


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job-id", required=True, type=UUID)
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--name", default="Local cloud")
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()
    try:
        if not args.job_id.int:
            raise ValueError("job-id must be a nonzero UUID")
        root = args.source_root.resolve(strict=True)
        if not root.is_dir():
            raise ValueError("source-root must be a directory")
        files, seen = [], set()
        for index, argument in enumerate(args.files, 1):
            path = argument.resolve(strict=True)
            relative = path.relative_to(root).as_posix()
            if path in seen:
                raise ValueError(f"Duplicate file: {argument}")
            seen.add(path)
            file_format = path.suffix[1:].lower()
            if file_format not in {"ply", "sog"}:
                raise ValueError(f"Expected a PLY or SOG file: {argument}")
            with path.open("rb") as source:
                digest = hashlib.file_digest(source, "sha256").hexdigest()
            files.append(
                {
                    "id": f"file-{index}",
                    "format": file_format,
                    "size_bytes": path.stat().st_size,
                    "sha256": digest,
                    "source": {"storage": "incoming", "path": relative},
                }
            )
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(
        json.dumps(
            {
                "schema_version": 2,
                "message_id": str(uuid4()),
                "job_id": str(args.job_id),
                "assets": [
                    {
                        "name": args.name,
                        "tags": ["local"],
                        "thumbnail_key": None,
                        "primary_file_id": files[0]["id"],
                        "files": files,
                    }
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
