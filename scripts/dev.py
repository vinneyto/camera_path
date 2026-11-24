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

from dotenv import dotenv_values, set_key, unset_key

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
BACKEND_ENV = BACKEND / ".env"
LEGACY_AMQP_SETTINGS = {
    "CAMERA_PATH_RABBITMQ_URL",
    "CAMERA_PATH_RABBITMQ_QUEUE",
    "CAMERA_PATH_GENERATION_OUTPUT_DIRECTORY",
    "CAMERA_PATH_GENERATION_REQUEST_QUEUE",
    "CAMERA_PATH_GENERATION_RESULT_QUEUE",
    "CAMERA_PATH_PAINTER_OUTPUT_DIRECTORY",
    "CAMERA_PATH_PAINTER_REQUEST_QUEUE",
    "CAMERA_PATH_PAINTER_RESULT_QUEUE",
}
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


def update_env(path, values, *, remove=()):
    current = dotenv_values(path)
    changes = {key: value for key, value in values.items() if current.get(key) != value}
    removed = current.keys() & set(remove)
    if not changes and not removed:
        return
    with TemporaryDirectory(dir=path.parent) as temp:
        updated = Path(temp) / ".env"
        shutil.copy2(path, updated)
        for key, value in changes.items():
            set_key(updated, key, value)
        for key in sorted(removed):
            unset_key(updated, key)
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
    # Keep explicit OpenAI/none, SQS and custom rotation on existing dev clones.
    # Re-running setup is the opt-in cutover, after any old workers have drained.
    current = dotenv_values(BACKEND_ENV)
    updates = {
        "CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG": effective_env(BACKEND_ENV).get(
            "CAMERA_PATH_GENERATION_DEFAULT_ROTATION_DEG"
        )
        or "[180,0,0]",
    }
    if current.get("CAMERA_PATH_MESSAGE_QUEUE") == "rabbitmq":
        updates["CAMERA_PATH_MESSAGE_QUEUE"] = "none"
        print("Migrating this clone from RabbitMQ to the Camera Path inference CLI.")
    update_env(BACKEND_ENV, updates, remove=LEGACY_AMQP_SETTINGS)


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


def setup_inference():
    if (platform.system(), platform.machine()) != ("Darwin", "arm64"):
        return
    answer = input(
        "Prepare local Painter and Trellis (downloads missing model weights) [y/N]? "
    )
    if answer.strip().lower() in ("y", "yes"):
        run("uv", "run", "--project", "cli", "camera-path", "download-weights")


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
        setup_inference()
    print("Setup complete. Run Dev Start.")


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
        ["docker", "port", "camera-path-mailpit"],
        capture_output=True,
        text=True,
        check=False,
    )
    mailpit_ports = {"1025/tcp -> 127.0.0.1:1025", "8025/tcp -> 127.0.0.1:8025"}
    if legacy.returncode == 0 and mailpit_ports.issubset(legacy.stdout.splitlines()):
        print("Using the existing camera-path-mailpit container.", flush=True)
        return
    run(*COMPOSE, "up", "-d", "--wait", "mailpit")


def service_command(service):
    if not BACKEND_ENV.is_file():
        raise SystemExit("Run ./scripts/dev.sh setup first.")

    backend_port = os.getenv("CAMERA_PATH_DEV_BACKEND_PORT", "8000")
    frontend_port = os.getenv("CAMERA_PATH_DEV_FRONTEND_PORT", "3000")
    if service == "backend":
        backend_env = os.environ.copy()
        if "CAMERA_PATH_DEV_FRONTEND_PORT" in os.environ:
            backend_env.setdefault(
                "CAMERA_PATH_CLI_WEB_URL", f"http://127.0.0.1:{frontend_port}"
            )
            backend_env.setdefault(
                "CAMERA_PATH_CORS_ORIGINS",
                f"http://localhost:{frontend_port},http://127.0.0.1:{frontend_port}",
            )
        return (
            BACKEND,
            backend_env,
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
    if service == "inference":
        require("uv")
        inference_env = os.environ.copy()
        inference_env.setdefault(
            "CAMERA_PATH_CLI_DEV_WEB_URL", f"http://127.0.0.1:{frontend_port}"
        )
        inference_env.setdefault(
            "CAMERA_PATH_CLI_DEV_API_URL", f"http://127.0.0.1:{backend_port}"
        )
        return (
            ROOT,
            inference_env,
            [
                "uv",
                "run",
                "--project",
                "cli",
                "camera-path",
                "--profile",
                "dev",
                "worker",
            ],
        )
    raise ValueError(f"Unknown service: {service}")


def run_service(service):
    cwd, env, args = service_command(service)
    print(f"Starting {service}", flush=True)
    os.chdir(cwd)
    os.execvpe(args[0], args, env)


def start():
    services = []
    for service in ("backend", "frontend"):
        services.append((service, *service_command(service)))

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
    actions = {
        "setup": setup,
        "start": start,
        "migrate": migrate,
        "infrastructure": start_infrastructure,
    }
    parser.add_argument(
        "action", choices=(*actions, "backend", "frontend", "inference")
    )
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
