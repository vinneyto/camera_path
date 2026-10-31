"""Run as root via SSM. Fetch an exact Git revision and restore DB/code on failure."""
import fcntl
import hashlib
import json
import os
import platform
import pwd
import re
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import time
import urllib.request
import uuid
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ROOT = Path("/opt/camera-path")
DATA = Path("/var/lib/camera-path")
ETC = Path("/etc/camera-path")
DATABASE = DATA / "backend/camera_path.sqlite3"
CURRENT = ROOT / "current"
UV = "/opt/camera-path-tools/bin/uv"
RUNTIME_OVERRIDE = Path("/etc/systemd/system/camera-path-backend.service.d/10-runtime.conf")


def run(*args, **kwargs):
    return subprocess.run(args, check=True, timeout=900, **kwargs)


def service(action):
    run("systemctl", action, "camera-path-backend")


def as_user(*args, cwd, env=None):
    account = pwd.getpwnam("camera-path")

    def demote():
        os.umask(0o077)
        os.setgroups([])
        os.setgid(account.pw_gid)
        os.setuid(account.pw_uid)

    # Secrets stay in the process environment, never argv/SSM output.
    child_env = {**os.environ, "HOME": str(ROOT), **(env or {})}
    return run(*args, cwd=cwd, env=child_env, preexec_fn=demote)


def own(path):
    account = pwd.getpwnam("camera-path")
    os.chown(path, account.pw_uid, account.pw_gid)


def atomic_write(path, content, mode=0o600):
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(content)
    temporary.chmod(mode)
    os.replace(temporary, path)


def switch_release(target):
    temporary = ROOT / "current.next"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    os.replace(temporary, CURRENT)


def sqlite_backup(source, destination):
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as src:
        with sqlite3.connect(destination) as dst:
            src.backup(dst)
            if dst.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("SQLite backup integrity check failed")
    destination.chmod(0o600)


def restore_database(backup):
    # Caller must have stopped every application writer before removing WAL/SHM.
    for suffix in ("-wal", "-shm"):
        Path(str(DATABASE) + suffix).unlink(missing_ok=True)
    if backup is None:
        DATABASE.unlink(missing_ok=True)
        return
    temporary = DATABASE.with_suffix(".restore")
    temporary.unlink(missing_ok=True)
    sqlite_backup(backup, temporary)
    own(temporary)
    os.replace(temporary, DATABASE)


def healthy():
    with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=5) as response:
        return response.status == 200 and json.load(response).get("status") == "ok"


def wait_healthy():
    for _ in range(30):
        try:
            if healthy():
                return
        except (OSError, ValueError):
            pass
        time.sleep(2)
    raise RuntimeError("Backend health check failed")


def wait_https_healthy(config):
    domain = config.get("api_domain")
    if not domain:
        return
    # Test certificate validity/hostname and Nginx locally, without an EIP hairpin.
    result = subprocess.run([
        "curl", "--fail", "--silent", "--show-error", "--max-time", "10",
        "--resolve", f"{domain}:443:127.0.0.1", f"https://{domain}/health",
    ], check=True, capture_output=True, text=True, timeout=15)
    if json.loads(result.stdout).get("status") != "ok":
        raise RuntimeError("HTTPS API health check failed")


def mount_data(config):
    serial = config["volume_id"].replace("-", "")
    device = Path(f"/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_{serial}")
    for _ in range(120):
        if device.exists():
            break
        time.sleep(2)
    else:
        raise RuntimeError("Expected EBS volume is not attached")
    result = subprocess.run(["blkid", "-s", "TYPE", "-o", "value", str(device)],
                            text=True, capture_output=True, check=False)
    if result.returncode == 2 and not result.stdout.strip():
        run("mkfs.ext4", "-L", "camera-path-data", str(device))
    elif result.returncode != 0 or result.stdout.strip() != "ext4":
        raise RuntimeError("Unexpected filesystem on data volume; refusing to format")
    volume_uuid = subprocess.check_output(
        ["blkid", "-s", "UUID", "-o", "value", str(device)], text=True
    ).strip()
    mounted = subprocess.run(["mountpoint", "-q", str(DATA)], check=False).returncode == 0
    if mounted:
        mounted_uuid = subprocess.check_output(
            ["findmnt", "-n", "-o", "UUID", "--mountpoint", str(DATA)], text=True
        ).strip()
        if mounted_uuid != volume_uuid:
            raise RuntimeError("Wrong volume mounted at data directory")
    else:
        run("mount", str(device), str(DATA))
    fstab = Path("/etc/fstab")
    entry = f"UUID={volume_uuid} {DATA} ext4 defaults,nofail 0 2"
    if entry not in fstab.read_text().splitlines():
        with fstab.open("a") as stream:
            stream.write(entry + "\n")
        run("systemctl", "daemon-reload")
    (DATA / "backend").mkdir(exist_ok=True)
    (DATA / "backend").chmod(0o750)
    own(DATA / "backend")


def environment(config):
    secrets = boto3.client("secretsmanager", region_name=config["region"])
    jwt = secrets.get_secret_value(SecretId=config["jwt_secret"])["SecretString"]
    values = {
        "CAMERA_PATH_DATABASE_URL": f"sqlite+aiosqlite:///{DATABASE}",
        "CAMERA_PATH_AWS_LIBRARY_STORAGE": "s3",
        "CAMERA_PATH_AWS_S3_BUCKET": config["library_bucket"],
        "CAMERA_PATH_AWS_S3_PREFIX": "library/",
        "CAMERA_PATH_AWS_REGION": config["region"],
        "CAMERA_PATH_JWT_SECRET": jwt,
        "CAMERA_PATH_ENVIRONMENT": "production",
        "CAMERA_PATH_AUTH_SECOND_FACTOR": "email",
        "CAMERA_PATH_AUTH_EMAIL_DELIVERY": "ses",
        "CAMERA_PATH_AUTH_EMAIL_FROM": config["auth_email_from"],
        # Existing systemd units also pick this up: never trust forwarded IPs.
        "FORWARDED_ALLOW_IPS": "",
    }
    try:
        values["OPENAI_API_KEY"] = secrets.get_secret_value(
            SecretId=config["openai_secret"]
        )["SecretString"]
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
    for key, value in values.items():
        if (not value and key != "FORWARDED_ALLOW_IPS") or any(char in value for char in '\n\r"\\'):
            raise ValueError("Secret/config must be a nonempty single-line value")
    return values


def runtime(config):
    selected = config.get("backend_runtime", "python")
    if selected not in {"python", "rust"}:
        raise ValueError("Unsupported backend runtime")
    return selected


def runtime_override(content):
    previous = RUNTIME_OVERRIDE.read_text() if RUNTIME_OVERRIDE.exists() else None
    if previous == content:
        return
    if content is None:
        RUNTIME_OVERRIDE.unlink(missing_ok=True)
    else:
        RUNTIME_OVERRIDE.parent.mkdir(parents=True, exist_ok=True)
        atomic_write(RUNTIME_OVERRIDE, content, 0o644)
    run("systemctl", "daemon-reload")


def select_runtime(selected):
    runtime_override(None if selected == "python" else (
        "[Service]\nWorkingDirectory=/opt/camera-path/current/backend-rust\n"
        "ExecStart=\nExecStart=/opt/camera-path/current/backend-rust/bin/camera-path "
        "serve --host 127.0.0.1 --port 8000\nTimeoutStopSec=90\n"
    ))


def install_rust_artifact(release, revision, config):
    key, checksum = config.get("rust_artifact_key", ""), config.get("rust_artifact_sha256", "")
    if (not key.startswith(f"releases/{revision}/") or not re.fullmatch(r"[a-f0-9]{64}", checksum)):
        raise ValueError("Rust release requires an exact revision artifact key and SHA-256")
    archive = release / "rust-release.tar.gz"
    boto3.client("s3", region_name=config["region"]).download_file(config["backups_bucket"], key, str(archive))
    with archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != checksum:
        raise ValueError("Rust artifact SHA-256 mismatch")
    destination = release / "backend-rust/bin"
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:gz") as package:
        members = package.getmembers()
        if (len(members) != 2 or {m.name for m in members} != {"camera-path", "manifest.json"}
                or any(not m.isfile() for m in members)):
            raise ValueError("Rust artifact must contain exactly two regular files")
        manifest_file = package.extractfile("manifest.json")
        if package.getmember("manifest.json").size > 65536:
            raise ValueError("Oversized artifact manifest")
        manifest = json.load(manifest_file)
        expected = {"x86_64": ("x86_64-unknown-linux-gnu", 62), "aarch64": ("aarch64-unknown-linux-gnu", 183)}
        target, machine = expected.get(platform.machine(), (None, None))
        if manifest.get("revision") != revision or manifest.get("target") != target or target is None:
            raise ValueError("Rust artifact revision/target mismatch")
        executable = destination / "camera-path"
        if package.getmember("camera-path").size > 512 * 1024 * 1024:
            raise ValueError("Oversized Rust executable")
        with package.extractfile("camera-path") as source, executable.open("wb") as output:
            shutil.copyfileobj(source, output)
        with executable.open("rb") as stream:
            header = stream.read(20)
        if (len(header) < 20 or header[:4] != b"\x7fELF" or header[4:6] != b"\x02\x01"
                or int.from_bytes(header[18:20], "little") != machine):
            raise ValueError("Rust artifact is not a compatible Linux ELF executable")
        executable.chmod(0o750)
        own(destination)
        own(executable)
    archive.unlink()
    atomic_write(release / ".artifact-sha256", checksum + "\n")


def prepare_release(revision, config=None):
    repository = ROOT / "repository.git"
    if not repository.exists():
        as_user("git", "init", "--bare", str(repository), cwd=ROOT)
        as_user("git", "--git-dir", str(repository), "remote", "add", "origin",
                "https://github.com/vinneyto/camera_path.git", cwd=ROOT)
    as_user("git", "--git-dir", str(repository), "fetch", "--depth=1", "origin", revision, cwd=ROOT)
    # A fresh directory/venv on every attempt avoids partially installed dependencies.
    release = ROOT / "releases" / f"{revision}-{uuid.uuid4().hex}"
    release.mkdir()
    own(release)
    archive = subprocess.Popen(["git", "--git-dir", str(repository), "archive", revision],
                               stdout=subprocess.PIPE)
    try:
        run("tar", "-x", "-C", str(release), stdin=archive.stdout)
    finally:
        archive.stdout.close()
    if archive.wait(timeout=30) != 0:
        raise RuntimeError("Git archive failed")
    run("chown", "-R", "camera-path:camera-path", str(release))
    config = config or {}
    if runtime(config) == "rust":
        install_rust_artifact(release, revision, config)
    else:
        as_user(UV, "sync", "--frozen", "--no-dev", "--extra", "aws", cwd=release / "backend")
    atomic_write(release / ".runtime", runtime(config) + "\n")
    return release


def deploy(revision, config):
    previous = CURRENT.resolve() if CURRENT.is_symlink() else None
    selected = runtime(config)
    old_runtime_override = RUNTIME_OVERRIDE.read_text() if RUNTIME_OVERRIDE.exists() else None
    env = environment(config)
    env_text = "".join(f'{key}="{value}"\n' for key, value in env.items())
    old_env = (ETC / "backend.env").read_text() if (ETC / "backend.env").exists() else None
    if (previous and (previous / ".revision").read_text().strip() == revision
            and env_text == old_env
            and ((previous / ".runtime").read_text().strip() if (previous / ".runtime").exists() else "python") == selected
            and (selected != "rust" or ((previous / ".artifact-sha256").exists()
                 and (previous / ".artifact-sha256").read_text().strip() == config.get("rust_artifact_sha256")) )):
        wait_healthy()
        wait_https_healthy(config)
        print("Requested revision is already healthy")
        return
    release = prepare_release(revision, config)
    backup_directory = DATA / "backups" / uuid.uuid4().hex
    backup_directory.mkdir(parents=True, mode=0o700)
    service("stop")
    # Until the backup is complete, no DB mutation is allowed.
    backup = backup_directory / "database.sqlite3" if DATABASE.exists() else None
    try:
        if backup:
            sqlite_backup(DATABASE, backup)
            boto3.client("s3", region_name=config["region"]).upload_file(
                str(backup), config["backups_bucket"], f"database/{backup_directory.name}.sqlite3"
            )
    except Exception:
        if previous:
            service("start")
        raise
    try:
        atomic_write(ETC / "backend.env", env_text, 0o600)
        own(ETC / "backend.env")
        if selected == "rust":
            as_user(str(release / "backend-rust/bin/camera-path"), "migrate", cwd=release / "backend-rust", env=env)
        else:
            as_user(str(release / "backend/.venv/bin/alembic"), "upgrade", "head", cwd=release / "backend", env=env)
        atomic_write(release / ".revision", revision + "\n")
        switch_release(release)
        select_runtime(selected)
        service("start")
        wait_healthy()
        wait_https_healthy(config)
    except Exception as failure:
        # Fail closed: never start the old code against an un-restored database.
        try:
            service("stop")
            restore_database(backup)
            if old_env is not None:
                atomic_write(ETC / "backend.env", old_env)
                own(ETC / "backend.env")
            else:
                (ETC / "backend.env").unlink(missing_ok=True)
            runtime_override(old_runtime_override)
            if previous:
                switch_release(previous)
                service("start")
                wait_healthy()
            else:
                CURRENT.unlink(missing_ok=True)
        except Exception as recovery:
            raise RuntimeError(f"Release failed AND recovery failed; backup: {backup_directory}") from recovery
        raise RuntimeError("Release failed; previous database and release restored") from failure
    print(f"Backend release {revision} is healthy")


def main():
    revision = sys.argv[1]
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Expected full commit SHA")
    with (ETC / "deployment.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        config = json.loads((ETC / "deployment.json").read_text())
        mount_data(config)
        deploy(revision, config)


if __name__ == "__main__":
    main()
