"""Local encoder adapter for the pinned Trellis image pipeline; no runtime downloads."""

import json
from pathlib import Path


def load_image_pipeline(model_dir: Path):
    import numpy as np
    import rembg
    import torch
    from torchvision import transforms
    from trellis.pipelines import TrellisImageTo3DPipeline, samplers
    from trellis.pipelines.base import Pipeline

    config = json.loads((model_dir / "pipeline.json").read_text())["args"]
    encoder = config["image_encoder"]
    for file in (
        Path(encoder["repo_dir"]) / "hubconf.py",
        Path(encoder["weights"]),
        Path(config["background_model"]),
    ):
        if not file.is_file():
            raise FileNotFoundError(f"Missing image model dependency: {file}. Run Dev Setup.")

    # The upstream factory downloads DINOv2 through torch.hub. Assemble its same
    # components from prepared local paths instead, using the pinned port's API.
    base = Pipeline.from_pretrained(str(model_dir))
    pipeline = TrellisImageTo3DPipeline()
    pipeline.__dict__ = base.__dict__
    for name in ("sparse_structure_sampler", "slat_sampler"):
        spec = config[name]
        setattr(pipeline, name, getattr(samplers, spec["name"])(**spec["args"]))
        setattr(pipeline, name + "_params", spec["params"])
    pipeline.slat_normalization = config["slat_normalization"]
    model = torch.hub.load(
        encoder["repo_dir"], config["image_cond_model"], source="local", pretrained=False
    )
    model.load_state_dict(torch.load(encoder["weights"], map_location="cpu", weights_only=True))
    pipeline.models["image_cond_model"] = model.eval()
    pipeline.image_cond_model_transform = transforms.Compose(
        [
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    pipeline.rembg_session = None
    upstream_preprocess = pipeline.preprocess_image

    def preprocess(image):
        alpha = np.asarray(image.getchannel("A")) if image.mode == "RGBA" else None
        if (alpha is None or np.all(alpha == 255)) and pipeline.rembg_session is None:
            pipeline.rembg_session = rembg.new_session(
                "u2net_custom",
                model_path=config["background_model"],
                providers=["CPUExecutionProvider"],
            )
        return upstream_preprocess(image)

    pipeline.preprocess_image = preprocess
    return pipeline
