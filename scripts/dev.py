import argparse
import asyncio
import fcntl
import hashlib
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


def update_env(path, values):
    current = dotenv_values(path)
    changes = {key: value for key, value in values.items() if current.get(key) != value}
    if not changes:
        return
    with TemporaryDirectory(dir=path.parent) as temp:
        updated = Path(temp) / ".env"
        shutil.copy2(path, updated)
        for key, value in changes.items():
            set_key(updated, key, value)
        updated.replace(path)


def configure_env():
    create_env(
        BACKEND_ENV,
        BACKEND / ".env.example",
        "\nCAMERA_PATH_DATABASE_URL=sqlite+aiosqlite:///./.dev/camera_path.sqlite3\n"
        "CAMERA_PATH_LIBRARY_DIRECTORY=.dev/library\n",
    )
    if not effective_env(BACKEND_ENV).get("CAMERA_PATH_JWT_SECRET"):
        update_env(BACKEND_ENV, {"CAMERA_PATH_JWT_SECRET": secrets.token_urlsafe(48)})
    create_env(FRONTEND / ".env.local", FRONTEND / ".env.example")
    create_env(GENERATION_ENV, GENERATION / ".env.example")
    clone_id = hashlib.sha256(os.fsencode(ROOT)).hexdigest()[:12]
    prefix = f"camera-path.{clone_id}"
    request_queue = f"{prefix}.generation.requests"
    result_queue = f"{prefix}.generation.results"
    update_env(
        BACKEND_ENV,
        {
            "CAMERA_PATH_MESSAGE_QUEUE": "rabbitmq",
            "CAMERA_PATH_RABBITMQ_QUEUE": f"{prefix}.job-completions",
            "CAMERA_PATH_GENERATION_REQUEST_QUEUE": request_queue,
            "CAMERA_PATH_GENERATION_RESULT_QUEUE": result_queue,
            "CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG": effective_env(BACKEND_ENV).get(
                "CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG"
            )
            or "[180,0,0]",
        },
    )
    update_env(
        GENERATION_ENV,
        {"GENERATION_REQUEST_QUEUE": request_queue, "GENERATION_RESULT_QUEUE": result_queue},
    )
    print(f"Configured RabbitMQ queues for {prefix}")


def migrate():
    run(sys.executable, "-m", "alembic", "upgrade", "head", cwd=BACKEND)


def create_editor():
    from camera_path.config import settings
    from camera_path.persistence.database import create_engine_and_session_factory
    from camera_path.repositories.auth import AuthRepository

    async def has_editor():
        engine, sessions = create_engine_and_session_factory(settings.database_url)
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


def trellis_paths():
    config = effective_env(GENERATION_ENV)
    model = config.get("GENERATION_MODEL_DIR")
    if not model:
        raise SystemExit("Set GENERATION_MODEL_DIR in generation/.env.")
    port = config.get("GENERATION_TRELLIS_PORT_DIR") or TRELLIS_PORT
    return Path(port).expanduser(), Path(model).expanduser()


def trellis_backend_settings():
    config = effective_env(GENERATION_ENV)
    output = Path(config.get("GENERATION_OUTPUT_DIR") or "~/.camera-path/generation").expanduser()
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
    image_model = Path(
        effective_env(GENERATION_ENV).get("GENERATION_IMAGE_MODEL_DIR")
        or "~/.camera-path/models/trellis-image-large"
    ).expanduser()
    if not (GENERATION / image_model / "pipeline.json").is_file():
        run(
            WORKER_PYTHON,
            "scripts/prepare_model.py",
            "--mode",
            "image",
            "--model-dir",
            image_model,
            cwd=GENERATION,
            env={**os.environ, "HF_HUB_OFFLINE": "0"},
        )
    update_env(GENERATION_ENV, {"GENERATION_IMAGE_MODEL_DIR": str(image_model)})
    if not enabled:
        update_env(BACKEND_ENV, trellis_backend_settings())


def setup():
    require("uv", "node", "npm", "rustup", "cargo", "rustc")
    if int(subprocess.check_output(["node", "-p", "process.versions.node.split('.')[0]"])) < 24:
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


def check_trellis_settings():
    from camera_path.config import settings

    if (platform.system(), platform.machine()) != ("Darwin", "arm64"):
        raise SystemExit("The configured Trellis worker requires Apple Silicon.")
    expected = trellis_backend_settings()
    output_key = "CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY"
    output = settings.generation_output_directory.expanduser().resolve()
    if str(output) != expected[output_key]:
        raise SystemExit("Match CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY to GENERATION_OUTPUT_DIR.")
    for key in (
        "CAMERA_PATH_RABBITMQ_URL",
        "CAMERA_PATH_GENERATION_REQUEST_QUEUE",
        "CAMERA_PATH_GENERATION_RESULT_QUEUE",
    ):
        value = getattr(settings, key.removeprefix("CAMERA_PATH_").lower())
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


def start_infrastructure():
    require("docker")
    # Reuse the standalone Mailpit container from the previous local instructions.
    legacy = subprocess.run(
        ["docker", "port", "camera-path-mailpit"], capture_output=True, text=True, check=False
    )
    mailpit_ports = {"1025/tcp -> 127.0.0.1:1025", "8025/tcp -> 127.0.0.1:8025"}
    services = ["rabbitmq"]
    if legacy.returncode == 0 and mailpit_ports.issubset(legacy.stdout.splitlines()):
        print("Using the existing camera-path-mailpit container.", flush=True)
    else:
        services.append("mailpit")
    run(*COMPOSE, "up", "-d", "--wait", *services)


def service_command(service):
    if not BACKEND_ENV.is_file():
        raise SystemExit("Run ./scripts/dev.sh setup first.")

    backend_port = os.getenv("CAMERA_PATH_DEV_BACKEND_PORT", "8000")
    if service == "backend":
        return (
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
        )
    if service == "frontend":
        require("npm", "wasm-pack")
        if not (FRONTEND / "node_modules").is_dir():
            raise SystemExit("Run ./scripts/dev.sh setup first.")
        frontend_env = os.environ.copy()
        if "CAMERA_PATH_DEV_BACKEND_PORT" in os.environ:
            frontend_env["CAMERA_PATH_BACKEND_URL"] = f"http://127.0.0.1:{backend_port}"
        return (
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
                os.getenv("CAMERA_PATH_DEV_FRONTEND_PORT", "3000"),
            ],
        )
    if not effective_env(BACKEND_ENV).get("CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY"):
        return None
    check_trellis_settings()
    port, model = trellis_paths()
    if not all(
        (
            WORKER_PYTHON.is_file(),
            (GENERATION / port / "trellis/pipelines").is_dir(),
            (GENERATION / model / "pipeline.json").is_file(),
        )
    ):
        raise SystemExit("Run Dev Setup to prepare the configured Trellis worker.")
    return GENERATION, os.environ, [WORKER_PYTHON, "-m", "camera_path_generation"]


def run_service(service):
    command = service_command(service)
    if command is None:
        print("Trellis is not configured. Run Dev Setup to enable it.", flush=True)
        return
    cwd, env, args = command
    print(f"Starting {service}", flush=True)
    os.chdir(cwd)
    os.execvpe(args[0], args, env)


def start():
    services = []
    for service in ("backend", "frontend", "trellis"):
        command = service_command(service)
        if command is not None:
            services.append((service, *command))

    def interrupt(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    start_infrastructure()
    frontend_port = os.getenv("CAMERA_PATH_DEV_FRONTEND_PORT", "3000")
    print(
        f"Frontend http://127.0.0.1:{frontend_port} · Mailpit http://127.0.0.1:8025",
        flush=True,
    )
    processes = []
    try:
        for name, cwd, env, command in services:
            print(f"Starting {name}", flush=True)
            processes.append(subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True))
        while True:
            for (name, *_), proc in zip(services, processes, strict=True):
                if (status := proc.poll()) is not None:
                    raise SystemExit(f"{name} stopped (exit {status}).")
            time.sleep(0.25)
    finally:
        stop_processes(processes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up and run the local Camera Path stack.")
    actions = {
        "setup": setup,
        "start": start,
        "migrate": migrate,
        "infrastructure": start_infrastructure,
    }
    parser.add_argument("action", choices=(*actions, "backend", "frontend", "trellis"))
    try:
        # The backend settings load .env from the current working directory.
        os.chdir(BACKEND)
        action = parser.parse_args().action
        if action in actions:
            actions[action]()
        else:
            run_service(action)
    except KeyboardInterrupt:
        sys.exit(130)
    except EOFError:
        sys.exit("Run Dev Setup in an interactive terminal.")
    except (OSError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
