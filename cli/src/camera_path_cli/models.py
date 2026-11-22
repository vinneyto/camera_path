"""Run model-specific adapters in independent Python environments."""

import asyncio
import json
import os
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

BRIDGE = Path(__file__).with_name("model_bridge.py").resolve()
PORT_REVISION = "f7c175a8620c2c23923d5b6fca3bf7f53604335f"
CAPABILITIES = {"painter": "generate_image", "generation": "generate_model"}


def python_for(directory):
    return directory / ".venv/bin/python"


def checked(*command, cwd, env=None):
    try:
        subprocess.run(command, cwd=cwd, env=env, check=True)
    except (OSError, subprocess.CalledProcessError):
        raise RuntimeError(f"Preparation failed in {cwd.name}; see the preceding error.") from None


def download_weights(root):
    import platform

    if (platform.system(), platform.machine()) != ("Darwin", "arm64"):
        raise ValueError("Preparing these model weights requires an Apple Silicon Mac.")
    if shutil.which("uv") is None:
        raise ValueError("Install uv before downloading weights.")
    painter, generation = root / "painter", root / "generation"
    # uv run exports the CLI's project environment; don't use it for model dependencies.
    env = {
        k: v for k, v in os.environ.items() if k not in {"UV_PROJECT_ENVIRONMENT", "VIRTUAL_ENV"}
    }
    checked(
        "uv", "sync", "--frozen", "--extra", "inference", "--python", "3.12", cwd=painter, env=env
    )
    if not python_for(generation).is_file():
        checked("uv", "venv", "--python", "3.12", ".venv", cwd=generation, env=env)
    checked(
        "uv",
        "pip",
        "install",
        "--python",
        python_for(generation),
        "-e",
        ".",
        "-r",
        "requirements-trellis-mps.txt",
        cwd=generation,
        env=env,
    )
    port = generation / "trellis-mac-mps"
    if not port.exists():
        with TemporaryDirectory(dir=generation) as tmp:
            checkout = Path(tmp) / "trellis"
            checked(
                "git",
                "clone",
                "--no-checkout",
                "https://github.com/vinayapathak/trellis-mac-mps.git",
                checkout,
                cwd=generation,
                env=env,
            )
            checked("git", "checkout", "--detach", PORT_REVISION, cwd=checkout, env=env)
            checked(
                "git", "apply", generation / "trellis-finite-opacity.patch", cwd=checkout, env=env
            )
            checkout.rename(port)
    env["HF_HUB_OFFLINE"] = "0"
    for cwd in (painter, generation):
        checked(python_for(cwd), BRIDGE, "prepare", cwd=cwd, env=env)
    print("Painter and Trellis text/image preparation finished.")


class LocalModels:
    def __init__(self, root):
        self.root = root

    async def _call(self, tool, action, *args, request=None):
        directory = self.root / tool
        executable = python_for(directory)
        if not executable.is_file():
            raise RuntimeError(f"{tool} isn't installed. Run camera-path download-weights.")
        proc = await asyncio.create_subprocess_exec(
            executable,
            BRIDGE,
            action,
            *args,
            stdin=asyncio.subprocess.PIPE if request is not None else asyncio.subprocess.DEVNULL,
            cwd=directory,
        )
        try:
            await proc.communicate(request)
        except asyncio.CancelledError:
            if proc.returncode is None:
                proc.kill()
            await proc.wait()
            raise
        if proc.returncode:
            raise RuntimeError(f"{tool} {action} failed")

    async def readiness(self):
        ready = []
        for tool, capability in CAPABILITIES.items():
            try:
                await self._call(tool, "check")
            except RuntimeError as error:
                print(error, flush=True)
                continue
            ready.append(capability)
        return ready

    async def run(self, command, attempt, parameters, directory):
        tool = {command: tool for tool, command in CAPABILITIES.items()}[command]
        await self._call(
            tool,
            "infer",
            str(directory),
            request=json.dumps(
                {"schema_version": 1, "job_id": attempt, "input": parameters}
            ).encode(),
        )
        return json.loads((directory / f"{attempt}.event.json").read_text())
