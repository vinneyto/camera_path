"""Lazy, offline FLUX inference. No application, database or 3D dependencies."""

import gc
import json
from pathlib import Path

from PIL import Image


class FluxRunner:
    def __init__(self, model_dir, *, device="mps", unload_after_job=True):
        self.config = json.loads((Path(model_dir) / "painter.json").read_text())
        self.device, self.unload_after_job = device, unload_after_job
        self.pipeline = self.background = None

    def __call__(self, parameters, target):
        import rembg
        import torch
        from diffusers import Flux2KleinPipeline

        if (
            parameters.model != self.config["model"]
            or parameters.revision != self.config["revision"]
        ):
            raise ValueError("Requested model does not match the prepared weights")
        if self.device == "mps" and not torch.backends.mps.is_available():
            raise ValueError("MPS is not available")
        try:
            if self.pipeline is None:
                self.pipeline = Flux2KleinPipeline.from_pretrained(
                    self.config["model_path"],
                    local_files_only=True,
                    dtype=torch.float32 if self.device == "cpu" else torch.bfloat16,
                ).to(self.device)
                self.pipeline.vae.enable_slicing()
            options = {}
            if parameters.image_path:
                with Image.open(parameters.image_path) as source:
                    rgba = source.convert("RGBA")
                background = Image.new("RGBA", rgba.size, "white")
                background.alpha_composite(rgba)
                options["image"] = background.convert("RGB")
            with torch.inference_mode():
                image = self.pipeline(
                    prompt=parameters.prompt,
                    width=parameters.width,
                    height=parameters.height,
                    num_inference_steps=parameters.steps,
                    guidance_scale=1.0,
                    generator=torch.Generator("cpu").manual_seed(parameters.seed),
                    **options,
                ).images[0]
            if self.background is None:
                self.background = rembg.new_session(
                    "u2net_custom",
                    model_path=self.config["background_model"],
                    providers=["CPUExecutionProvider"],
                )
            rembg.remove(image, session=self.background).save(target)
        finally:
            if self.unload_after_job:
                self.pipeline = None
                gc.collect()
                if self.device == "mps":
                    torch.mps.empty_cache()
