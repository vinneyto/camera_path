"""Prepare local Trellis text/image models, encoders and background removal."""

import argparse
import json
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from huggingface_hub import hf_hub_download

TEXT_REPO = "microsoft/TRELLIS-text-base"
TEXT_REVISION = "f8e8cf00c40d53dea26b718e49169ce83cf24c67"
IMAGE_REPO = "microsoft/TRELLIS-image-large"
IMAGE_REVISION = "25e0d31ffbebe4b5a97464dd851910efc3002d96"
CLIP_REPO = "openai/clip-vit-large-patch14"
CLIP_REVISION = "32bd64288804d66eefd0ccbe215aa642df71cc41"
DINOV2_REVISION = "7764ea0f912e53c92e82eb78a2a1631e92725fc8"

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


def prepare_model(model_dir: Path, mode: str = "text") -> Path:
    repo, revision = (IMAGE_REPO, IMAGE_REVISION) if mode == "image" else (TEXT_REPO, TEXT_REVISION)
    upstream = hf_hub_download(repo, "pipeline.json", revision=revision)
    config = json.loads(Path(upstream).read_text(encoding="utf-8"))
    args = config["args"]
    models = {}
    for name, (repo, revision) in CHECKPOINT_SOURCES.items():
        if mode == "image":
            repo, revision = IMAGE_REPO, IMAGE_REVISION
        checkpoint = args["models"][name].removeprefix("JeffreyXiang/TRELLIS-image-large/")
        hf_hub_download(repo, f"{checkpoint}.json", revision=revision)
        weights = hf_hub_download(repo, f"{checkpoint}.safetensors", revision=revision)
        models[name] = str(Path(weights).absolute().with_suffix(""))
    args["models"] = models

    if mode == "text":
        for filename in CLIP_FILES:
            clip_file = hf_hub_download(CLIP_REPO, filename, revision=CLIP_REVISION)
        args["text_cond_model"] = str(Path(clip_file).absolute().parent)
    else:
        args["image_encoder"], args["background_model"] = prepare_image_dependencies(model_dir)

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


def prepare_image_dependencies(model_dir: Path) -> tuple[dict, str]:
    import torch
    from rembg.sessions.u2net import U2netSession

    model_dir.mkdir(parents=True, exist_ok=True)
    code = model_dir / f"dinov2-{DINOV2_REVISION}"
    if not code.exists():
        with TemporaryDirectory(dir=model_dir) as temp:
            staged = Path(temp) / "dinov2"
            subprocess.run(
                [
                    "git",
                    "clone",
                    "--filter=blob:none",
                    "--no-checkout",
                    "https://github.com/facebookresearch/dinov2.git",
                    str(staged),
                ],
                check=True,
            )
            subprocess.run(
                ["git", "-C", str(staged), "checkout", "--detach", DINOV2_REVISION], check=True
            )
            staged.rename(code)
    weights = Path(torch.hub.get_dir()) / "checkpoints" / "dinov2_vitl14_reg4_pretrain.pth"
    if not weights.is_file():
        weights.parent.mkdir(parents=True, exist_ok=True)
        torch.hub.download_url_to_file(
            "https://dl.fbaipublicfiles.com/dinov2/dinov2_vitl14/dinov2_vitl14_reg4_pretrain.pth",
            str(weights),
        )
    background = U2netSession.download_models()
    return {"repo_dir": str(code), "weights": str(weights)}, str(Path(background).resolve())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("text", "image"),
        default="text",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
    )
    args = parser.parse_args()
    try:
        default = "trellis-image-large" if args.mode == "image" else "trellis-text-base"
        directory = args.model_dir or Path.home() / ".camera-path" / "models" / default
        config = prepare_model(directory.expanduser().resolve(), args.mode)
    except FileExistsError as error:
        parser.error(str(error))
    setting = "GENERATION_IMAGE_MODEL_DIR" if args.mode == "image" else "GENERATION_MODEL_DIR"
    print(f"{setting}={config.parent}")


if __name__ == "__main__":
    main()
