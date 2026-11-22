"""Stand-alone process running inside Painter or Trellis's model environment."""

import json
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv


def model_dir(env, name):
    return Path(os.getenv(env) or f"~/.camera-path/models/{name}").expanduser().resolve()


def paths():
    return (
        model_dir("PAINTER_MODEL_DIR", "flux2-klein-4b"),
        model_dir("GENERATION_MODEL_DIR", "trellis-text-base"),
        model_dir("GENERATION_IMAGE_MODEL_DIR", "trellis-image-large"),
    )


def read_json(path):
    return json.loads(path.read_text())


def check_painter(directory):
    from camera_path_painter.service import MODEL, REVISION
    from diffusers import Flux2KleinPipeline  # noqa: F401

    config = read_json(directory / "painter.json")
    if (config["model"], config["revision"]) != (MODEL, REVISION):
        raise ValueError("Painter weights do not match the configured runner.")
    snapshot = Path(config["model_path"])
    if (
        not (snapshot / "model_index.json").is_file()
        or not Path(config["background_model"]).is_file()
        or any(
            not tuple((snapshot / component).glob("*.safetensors"))
            or any(not path.is_file() for path in (snapshot / component).glob("*.safetensors"))
            for component in ("text_encoder", "transformer", "vae")
        )
    ):
        raise FileNotFoundError("Painter checkpoints are incomplete.")


def check_trellis(text, image):
    for directory in (text, image):
        args = read_json(directory / "pipeline.json")["args"]
        if not args["models"] or any(
            not Path(path + suffix).is_file()
            for path in args["models"].values()
            for suffix in (".json", ".safetensors")
        ):
            raise FileNotFoundError("Trellis checkpoints are incomplete.")
        if directory == text:
            if not (Path(args["text_cond_model"]) / "model.safetensors").is_file():
                raise FileNotFoundError("Trellis CLIP encoder is missing.")
        elif not (
            (Path(args["image_encoder"]["repo_dir"]) / "hubconf.py").is_file()
            and Path(args["image_encoder"]["weights"]).is_file()
            and Path(args["background_model"]).is_file()
        ):
            raise FileNotFoundError("Trellis image encoder or background weights are missing.")


def main():
    load_dotenv(Path.cwd() / ".env", override=False)
    painter, text, image = paths()
    is_painter = Path.cwd().name == "painter"
    action = sys.argv[1]
    if action == "prepare":
        if is_painter:
            commands = [("--model-dir", painter)]
        else:
            commands = [
                ("--mode", "text", "--model-dir", text),
                ("--mode", "image", "--model-dir", image),
            ]
        for args in commands:
            subprocess.run([sys.executable, "scripts/prepare_model.py", *args], check=True)
        return
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ.setdefault("SPARSE_BACKEND", "pytorch")
    os.environ.setdefault("ATTN_BACKEND", "sdpa")
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    port = (
        Path(os.getenv("GENERATION_TRELLIS_PORT_DIR") or "trellis-mac-mps").expanduser().resolve()
    )
    if not is_painter:
        if not (port / "trellis/pipelines").is_dir():
            raise FileNotFoundError("Prepared Trellis port is missing.")
        sys.path.insert(0, str(port))
    device = os.getenv("PAINTER_DEVICE", "mps") if is_painter else "mps"
    if action == "check":
        import rembg  # noqa: F401
        import torch

        if device == "mps" and not torch.backends.mps.is_available():
            raise ValueError("MPS is unavailable.")
        if is_painter:
            check_painter(painter)
        else:
            from trellis.pipelines import TrellisTextTo3DPipeline  # noqa: F401

            check_trellis(text, image)
        return
    if action != "infer":
        raise ValueError("Unknown model bridge action.")
    directory, raw = Path(sys.argv[2]), sys.stdin.buffer.read(256 * 1024 + 1)
    if is_painter:
        from camera_path_painter.flux_runner import FluxRunner
        from camera_path_painter.service import PainterService

        service = PainterService(directory, FluxRunner(painter, device=device))
    else:
        from camera_path_generation.service import GenerationService
        from camera_path_generation.trellis_runner import TrellisRunner

        service = GenerationService(directory, TrellisRunner(text, image))
    result = service.process(raw)
    if not result["job_id"]:
        raise ValueError("The model runner rejected the job identifier.")
    target = directory / f"{result['job_id']}.event.json"
    temp = target.with_suffix(".tmp")
    temp.write_text(json.dumps(result))
    temp.replace(target)


if __name__ == "__main__":
    main()
