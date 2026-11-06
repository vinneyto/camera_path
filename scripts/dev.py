import argparse
import asyncio
import fcntl
import os
import platform
import secrets
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory

from dotenv import dotenv_values, set_key

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
GENERATION = ROOT / "generation"
BACKEND_ENV = BACKEND / ".env"
GENERATION_ENV = GENERATION / ".env"
WORKER_PYTHON = GENERATION / ".venv/bin/python"
TRELLIS_PORT = GENERATION / "trellis-mac-mps"
TRELLIS_REVISION = "f7c175a8620c2c23923d5b6fca3bf7f53604335f"
COMPOSE = ["docker", "compose", "-f", str(BACKEND / "compose.yaml")]


def run(*args, cwd=ROOT, env=None):
    subprocess.run(args, cwd=cwd, env=env, check=True)


def require(*commands):
    missing = [command for command in commands if shutil.which(command) is None]
    if missing:
        raise SystemExit(f"Install and add to PATH: {', '.join(missing)}")


def effective_env(path):
    return {**dotenv_values(path), **os.environ}


def create_env(path, example, extra=""):
    with NamedTemporaryFile(mode="w", dir=path.parent) as target:
        target.write(example.read_text() + extra)
        target.flush()
        try:
            Path(path).hardlink_to(target.name)
        except FileExistsError:
            return
    print(f"Created {path.relative_to(ROOT)}")


def configure_env():
    create_env(
        BACKEND_ENV,
        BACKEND / ".env.example",
        "\nCAMERA_PATH_DATABASE_URL=sqlite+aiosqlite:///./.dev/camera_path.sqlite3\n"
        "CAMERA_PATH_LIBRARY_DIRECTORY=.dev/library\n",
    )
    if not effective_env(BACKEND_ENV).get("CAMERA_PATH_JWT_SECRET"):
        set_key(BACKEND_ENV, "CAMERA_PATH_JWT_SECRET", secrets.token_urlsafe(48))
    create_env(FRONTEND / ".env.local", FRONTEND / ".env.example")
    create_env(GENERATION_ENV, GENERATION / ".env.example")


def migrate():
    run(sys.executable, "-m", "alembic", "upgrade", "head", cwd=BACKEND)


def create_editor():
    os.chdir(BACKEND)
    try:
        from camera_path.config import Settings
        from camera_path.persistence.database import create_engine_and_session_factory
        from camera_path.repositories.auth import AuthRepository

        async def has_editor():
            engine, sessions = create_engine_and_session_factory(
                Settings().database_url
            )
            try:
                async with sessions() as session:
                    return await AuthRepository(sessions).editor(session) is not None
            finally:
                await engine.dispose()

        if asyncio.run(has_editor()):
            print("Editor already exists.")
        else:
            email = input("Editor email: ").strip()
            run(BACKEND / ".venv/bin/editor-create", email, cwd=BACKEND)
    finally:
        os.chdir(ROOT)


def trellis_paths():
    config = effective_env(GENERATION_ENV)
    model = config.get("GENERATION_MODEL_DIR")
    if not model:
        raise SystemExit("Set GENERATION_MODEL_DIR in generation/.env.")
    port = config.get("GENERATION_TRELLIS_PORT_DIR") or TRELLIS_PORT
    return Path(port).expanduser(), Path(model).expanduser()


def trellis_backend_settings():
    config = effective_env(GENERATION_ENV)
    output = Path(
        config.get("GENERATION_OUTPUT_DIR") or "~/.camera-path/generation"
    ).expanduser()
    return {
        "CAMERA_PATH_MESSAGE_QUEUE": "rabbitmq",
        "CAMERA_PATH_RABBITMQ_URL": config.get("GENERATION_AMQP_URL")
        or "amqp://guest:guest@127.0.0.1:5672/",
        "CAMERA_PATH_GENERATION_REQUEST_QUEUE": config.get("GENERATION_REQUEST_QUEUE")
        or "camera-path.generation.requests",
        "CAMERA_PATH_GENERATION_RESULT_QUEUE": config.get("GENERATION_RESULT_QUEUE")
        or "camera-path.generation.results",
        "CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY": str((GENERATION / output).resolve()),
    }


def setup_trellis():
    backend = effective_env(BACKEND_ENV)
    enabled = bool(backend.get("CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY"))
    if (platform.system(), platform.machine()) != ("Darwin", "arm64"):
        if enabled:
            raise SystemExit("The configured Trellis worker requires Apple Silicon.")
        return
    if not enabled:
        answer = input("Set up Trellis (downloads missing model weights) [y/N]? ")
        if answer.strip().lower() not in ("y", "yes"):
            return

    port, model = trellis_paths()
    if port == TRELLIS_PORT and not port.exists():
        require("git")
        with TemporaryDirectory(dir=GENERATION) as temp:
            checkout = Path(temp) / "trellis"
            run(
                "git",
                "clone",
                "https://github.com/vinayapathak/trellis-mac-mps.git",
                checkout,
            )
            run("git", "-C", checkout, "checkout", "--detach", TRELLIS_REVISION)
            run(
                "git",
                "-C",
                checkout,
                "apply",
                GENERATION / "trellis-finite-opacity.patch",
            )
            checkout.rename(port)
    if not (GENERATION / port / "trellis/pipelines").is_dir():
        raise SystemExit("GENERATION_TRELLIS_PORT_DIR must contain trellis/pipelines.")
    if not WORKER_PYTHON.is_file():
        run("uv", "venv", "--python", "3.12", ".venv", cwd=GENERATION)
    run(
        "uv",
        "pip",
        "install",
        "--python",
        WORKER_PYTHON,
        "-e",
        ".",
        "-r",
        "requirements-trellis-mps.txt",
        cwd=GENERATION,
    )
    run(
        WORKER_PYTHON,
        "-c",
        "import torch; assert torch.backends.mps.is_available(), 'Trellis requires MPS'",
        cwd=GENERATION,
    )
    if not (GENERATION / model / "pipeline.json").is_file():
        run(
            WORKER_PYTHON,
            "scripts/prepare_model.py",
            "--model-dir",
            model,
            cwd=GENERATION,
            env={**os.environ, "HF_HUB_OFFLINE": "0"},
        )
    if not enabled:
        # Commit the matching backend settings together after the worker is ready.
        with TemporaryDirectory(dir=BACKEND) as temp:
            updated = Path(temp) / ".env"
            shutil.copy2(BACKEND_ENV, updated)
            for key, value in trellis_backend_settings().items():
                set_key(updated, key, value)
            updated.replace(BACKEND_ENV)


def setup():
    require("uv", "node", "npm", "rustup", "cargo", "rustc")
    if (
        int(
            subprocess.check_output(
                ["node", "-p", "process.versions.node.split('.')[0]"]
            )
        )
        < 24
    ):
        raise SystemExit("Install Node.js 24 or newer.")
    version = subprocess.check_output(["rustc", "--version"], text=True).split()[1]
    if tuple(map(int, version.split(".")[:2])) < (1, 95):
        raise SystemExit("Install Rust 1.95 or newer.")
    state = BACKEND / ".dev"
    state.mkdir(exist_ok=True)
    with (state / "setup.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        configure_env()
        run("rustup", "target", "add", "wasm32-unknown-unknown")
        if shutil.which("wasm-pack") is None:
            run("cargo", "install", "wasm-pack", "--version", "0.15.0", "--locked")
        run("npm", "ci", cwd=FRONTEND)
        migrate()
        create_editor()
        setup_trellis()
    print("Setup complete. Run Dev Start.")


def check_trellis_settings(backend):
    from camera_path.config import Settings

    if (platform.system(), platform.machine()) != ("Darwin", "arm64"):
        raise SystemExit("The configured Trellis worker requires Apple Silicon.")
    expected = trellis_backend_settings()
    configured = Settings(_env_file=BACKEND_ENV)
    output_key = "CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY"
    output = (BACKEND / Path(backend[output_key]).expanduser()).resolve()
    if str(output) != expected[output_key]:
        raise SystemExit(
            "Match CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY to GENERATION_OUTPUT_DIR."
        )
    for key in (
        "CAMERA_PATH_RABBITMQ_URL",
        "CAMERA_PATH_GENERATION_REQUEST_QUEUE",
        "CAMERA_PATH_GENERATION_RESULT_QUEUE",
    ):
        value = getattr(configured, key.removeprefix("CAMERA_PATH_").lower())
        if key == "CAMERA_PATH_RABBITMQ_URL":
            value = value.get_secret_value()
        if value != expected[key]:
            raise SystemExit(
                f"Match {key} in backend/.env to the worker settings in generation/.env."
            )


def stop_processes(processes):
    for proc in processes:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + 5
    for proc in processes:
        try:
            proc.wait(timeout=max(0, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait()


def start():
    require("docker", "npm", "wasm-pack")
    if not BACKEND_ENV.is_file() or not (FRONTEND / "node_modules").is_dir():
        raise SystemExit("Run ./scripts/dev.sh setup first.")
    backend = effective_env(BACKEND_ENV)
    trellis = bool(backend.get("CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY"))
    if trellis:
        check_trellis_settings(backend)
        port, model = trellis_paths()
        if not all(
            (
                WORKER_PYTHON.is_file(),
                (GENERATION / port / "trellis/pipelines").is_dir(),
                (GENERATION / model / "pipeline.json").is_file(),
            )
        ):
            raise SystemExit("Run Dev Setup to prepare the configured Trellis worker.")

    backend_port = os.getenv("CAMERA_PATH_DEV_BACKEND_PORT", "8000")
    frontend_port = os.getenv("CAMERA_PATH_DEV_FRONTEND_PORT", "3000")
    frontend_env = os.environ.copy()
    if "CAMERA_PATH_DEV_BACKEND_PORT" in os.environ:
        frontend_env["CAMERA_PATH_BACKEND_URL"] = f"http://127.0.0.1:{backend_port}"
    services = [
        (
            "backend",
            BACKEND,
            os.environ,
            [
                sys.executable,
                "-m",
                "uvicorn",
                "camera_path.api:app",
                "--reload",
                "--no-proxy-headers",
                "--host",
                "127.0.0.1",
                "--port",
                backend_port,
            ],
        ),
        (
            "frontend",
            FRONTEND,
            frontend_env,
            [
                "npm",
                "run",
                "dev",
                "--",
                "--hostname",
                "127.0.0.1",
                "--port",
                frontend_port,
            ],
        ),
    ]
    if trellis:
        services.append(
            (
                "Trellis",
                GENERATION,
                os.environ,
                [WORKER_PYTHON, "-m", "camera_path_generation"],
            )
        )

    def interrupt(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    run(*COMPOSE, "up", "-d", "--wait", "rabbitmq", "mailpit")
    print(
        f"Frontend http://127.0.0.1:{frontend_port} · Mailpit http://127.0.0.1:8025",
        flush=True,
    )
    processes = []
    try:
        for name, cwd, env, command in services:
            print(f"Starting {name}", flush=True)
            processes.append(
                subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True)
            )
        while True:
            for (name, *_), proc in zip(services, processes, strict=True):
                if (status := proc.poll()) is not None:
                    raise SystemExit(f"{name} stopped (exit {status}).")
            time.sleep(0.25)
    finally:
        stop_processes(processes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Set up and run the local Camera Path stack."
    )
    parser.add_argument("action", choices=("setup", "start", "migrate"))
    try:
        {"setup": setup, "start": start, "migrate": migrate}[
            parser.parse_args().action
        ]()
    except KeyboardInterrupt:
        sys.exit(130)
    except EOFError:
        sys.exit("Run Dev Setup in an interactive terminal.")
    except (OSError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
