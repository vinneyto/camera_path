import gc
import os
from pathlib import Path

from .service import GenerationInput, ImageGenerationInput


class TrellisRunner:
    def __init__(self, model_dir: Path, image_model_dir: Path | None = None):
        self.model_dir = model_dir
        self.image_model_dir = image_model_dir
        self._pipeline = None
        self._mode = None

    def __call__(self, parameters: GenerationInput, destination: Path) -> None:
        os.environ.setdefault("SPARSE_BACKEND", "pytorch")
        os.environ.setdefault("ATTN_BACKEND", "sdpa")
        os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

        import torch

        if not torch.backends.mps.is_available():
            raise RuntimeError("Trellis requires an available MPS device")
        mode = "image" if isinstance(parameters, ImageGenerationInput) else "text"
        if self._pipeline is None or self._mode != mode:
            # Keep only the current pipeline resident on the Mac's shared memory.
            self._pipeline = None
            gc.collect()
            torch.mps.empty_cache()
            if mode == "image":
                from .image_pipeline import load_image_pipeline

                if self.image_model_dir is None:
                    raise RuntimeError("Set GENERATION_IMAGE_MODEL_DIR and prepare the image model")
                pipeline = load_image_pipeline(self.image_model_dir)
            else:
                from trellis.pipelines import TrellisTextTo3DPipeline

                pipeline = TrellisTextTo3DPipeline.from_pretrained(str(self.model_dir))
            pipeline.to("mps")
            if mode == "text":
                pipeline.text_cond_model["model"].to("mps")
                pipeline.text_cond_model["null_cond"] = pipeline.text_cond_model["null_cond"].to(
                    "mps"
                )
            self._pipeline = pipeline
            self._mode = mode

        with torch.inference_mode():
            if isinstance(parameters, ImageGenerationInput):
                from PIL import Image, ImageOps

                with Image.open(parameters.image_path) as original:
                    image = ImageOps.exif_transpose(original).convert("RGBA")
                outputs = self._pipeline.run(image, seed=42, formats=["gaussian"])
            else:
                outputs = self._pipeline.run(parameters.prompt, seed=42, formats=["gaussian"])
            outputs["gaussian"][0].save_ply(str(destination))
            torch.mps.synchronize()
