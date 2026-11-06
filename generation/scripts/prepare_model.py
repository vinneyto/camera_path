"""Download and configure the checkpoints for Trellis text-to-Gaussian-PLY."""

import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from huggingface_hub import hf_hub_download

TEXT_REPO = "microsoft/TRELLIS-text-base"
TEXT_REVISION = "f8e8cf00c40d53dea26b718e49169ce83cf24c67"
IMAGE_REPO = "microsoft/TRELLIS-image-large"
IMAGE_REVISION = "25e0d31ffbebe4b5a97464dd851910efc3002d96"
CLIP_REPO = "openai/clip-vit-large-patch14"
CLIP_REVISION = "32bd64288804d66eefd0ccbe215aa642df71cc41"

CHECKPOINT_SOURCES = {
    "sparse_structure_decoder": (IMAGE_REPO, IMAGE_REVISION),
    "sparse_structure_flow_model": (TEXT_REPO, TEXT_REVISION),
    "slat_decoder_gs": (IMAGE_REPO, IMAGE_REVISION),
    "slat_flow_model": (TEXT_REPO, TEXT_REVISION),
}
CLIP_FILES = (
    "config.json",
    "model.safetensors",
    "merges.txt",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
)


def prepare_model(model_dir: Path) -> Path:
    upstream = hf_hub_download(TEXT_REPO, "pipeline.json", revision=TEXT_REVISION)
    config = json.loads(Path(upstream).read_text(encoding="utf-8"))
    args = config["args"]
    models = {}
    for name, (repo, revision) in CHECKPOINT_SOURCES.items():
        checkpoint = args["models"][name].removeprefix("JeffreyXiang/TRELLIS-image-large/")
        hf_hub_download(repo, f"{checkpoint}.json", revision=revision)
        weights = hf_hub_download(repo, f"{checkpoint}.safetensors", revision=revision)
        models[name] = str(Path(weights).absolute().with_suffix(""))
    args["models"] = models

    for filename in CLIP_FILES:
        clip_file = hf_hub_download(CLIP_REPO, filename, revision=CLIP_REVISION)
    args["text_cond_model"] = str(Path(clip_file).absolute().parent)

    content = json.dumps(config, indent=2) + "\n"
    model_dir.mkdir(parents=True, exist_ok=True)
    config_file = model_dir / "pipeline.json"
    with TemporaryDirectory(dir=model_dir) as temp:
        staged = Path(temp) / "pipeline.json"
        staged.write_text(content, encoding="utf-8")
        try:
            config_file.hardlink_to(staged)
        except FileExistsError:
            if config_file.read_text(encoding="utf-8") != content:
                raise FileExistsError(
                    f"{config_file} already contains a different configuration. "
                    "Choose another --model-dir."
                ) from None
    return config_file


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=Path.home() / ".camera-path" / "models" / "trellis-text-base",
    )
    args = parser.parse_args()
    try:
        config = prepare_model(args.model_dir.expanduser().resolve())
    except FileExistsError as error:
        parser.error(str(error))
    print(f"GENERATION_MODEL_DIR={config.parent}")


if __name__ == "__main__":
    main()
