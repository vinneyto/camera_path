"""Download missing weights once and prepare an offline painter configuration."""

import argparse
import json
import os
from pathlib import Path

from camera_path_painter.service import MODEL, REVISION
from dotenv import load_dotenv


def main():
    root = Path("painter") if Path("painter/pyproject.toml").is_file() else Path.cwd()
    load_dotenv(root / ".env", override=False)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=os.getenv("PAINTER_MODEL_DIR", "~/.camera-path/models/flux2-klein-4b"),
    )
    args = parser.parse_args()
    # Preparation is the only command that downloads weights; normal inference is offline.
    os.environ.pop("HF_HUB_OFFLINE", None)
    from huggingface_hub import snapshot_download
    from rembg.sessions.u2net import U2netSession

    model = snapshot_download(
        MODEL,
        revision=REVISION,
        allow_patterns=[
            "model_index.json",
            "scheduler/*",
            "tokenizer/*",
            "text_encoder/*",
            "transformer/*",
            "vae/*",
            "LICENSE.md",
        ],
    )
    background = U2netSession.download_models()
    target = args.model_dir.expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    config = {
        "model": MODEL,
        "revision": REVISION,
        "model_path": str(Path(model).resolve()),
        "background_model": str(Path(background).resolve()),
    }
    temporary = target / "painter.json.tmp"
    temporary.write_text(json.dumps(config, indent=2) + "\n")
    temporary.replace(target / "painter.json")
    print(f"Prepared painter at {target}")


if __name__ == "__main__":
    main()
