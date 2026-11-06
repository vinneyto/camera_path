import os
from pathlib import Path


class TrellisRunner:
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self._pipeline = None

    def __call__(self, prompt: str, destination: Path) -> None:
        os.environ.setdefault("SPARSE_BACKEND", "pytorch")
        os.environ.setdefault("ATTN_BACKEND", "sdpa")
        os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

        import torch

        if self._pipeline is None:
            from trellis.pipelines import TrellisTextTo3DPipeline

            if not torch.backends.mps.is_available():
                raise RuntimeError("Trellis requires an available MPS device")
            pipeline = TrellisTextTo3DPipeline.from_pretrained(str(self.model_dir))
            pipeline.to("mps")
            pipeline.text_cond_model["model"].to("mps")
            pipeline.text_cond_model["null_cond"] = pipeline.text_cond_model["null_cond"].to("mps")
            self._pipeline = pipeline

        with torch.inference_mode():
            outputs = self._pipeline.run(prompt, seed=42, formats=["gaussian"])
            outputs["gaussian"][0].save_ply(str(destination))
            torch.mps.synchronize()
