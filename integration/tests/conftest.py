"""Real subprocess + HTTP harness, reusable for a different backend implementation."""

import json
import os
import re
import secrets
import shlex
import socket
import subprocess
import time
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import pytest
from servers import Mailbox, ResponsesServer

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = json.loads((ROOT / "backend/openapi.json").read_text())
OPERATIONS = [
    (method.upper(), path, op["operationId"])
    for path, item in CONTRACT["paths"].items()
    for method, op in item.items()
    if method in {"get", "post", "patch", "delete", "put"}
]
DEV_CONTRACT = json.loads((ROOT / "backend/openapi.dev.json").read_text())
DEV_OPERATIONS = [
    (method.upper(), path, op["operationId"])
    for path, item in DEV_CONTRACT["paths"].items()
    if path.startswith("/api/v1/dev/")
    for method, op in item.items()
    if method in {"get", "post"}
]
COVERAGE = {}


def pytest_addoption(parser):
    parser.addoption("--api-report", default="api-coverage.json")
    parser.addoption("--require-api-coverage", action="store_true")


def pytest_sessionfinish(session, exitstatus):
    report = {
        op: {"method": method, "path": path, "statuses": sorted(COVERAGE.get(op, set()))}
        for method, path, op in OPERATIONS + DEV_OPERATIONS
    }
    Path(session.config.getoption("--api-report")).write_text(json.dumps(report, indent=2) + "\n")
    # A failed/interrupted run has only partial coverage. Preserve the original failure
    # instead of raising a second exception about scenarios which could not run.
    if exitstatus != pytest.ExitCode.OK:
        return
    if session.config.getoption("--require-api-coverage"):
        # Resend success has a real 60s cooldown; the slow test is opt-in.
        allowed = {"resendEditorCode"}
        missing = [
            op
            for op, v in report.items()
            if op not in allowed and not any(200 <= code < 300 for code in v["statuses"])
        ]
        if missing:
            reporter = session.config.pluginmanager.getplugin("terminalreporter")
            if reporter is not None:
                reporter.write_line(f"No successful HTTP scenario for: {missing}", red=True)
            session.exitstatus = pytest.ExitCode.TESTS_FAILED


def record(response):
    path = response.request.url.path
    for method, template, operation in OPERATIONS + DEV_OPERATIONS:
        pattern = re.sub(r"\{[^}]+\}", "[^/]+", template)
        if response.request.method == method and re.fullmatch(pattern, path):
            COVERAGE.setdefault(operation, set()).add(response.status_code)
            break


class Backend:
    def __init__(self, directory):
        self.directory = directory
        self.mail = Mailbox()
        self.llm = ResponsesServer()
        self.process = None
        self.token = None
        self.email = "editor@example.test"
        self.password = secrets.token_urlsafe(24)
        self.log = (directory / "backend.log").open("w+")
        # Deliberately do not inherit user .env, provider credentials, proxies or Python paths.
        self.env = {
            key: value
            for key, value in os.environ.items()
            if key in {"PATH", "HOME", "SYSTEMROOT", "TMPDIR", "LANG"}
        }
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        self.port = port
        self.url = f"http://127.0.0.1:{port}"
        self.env.update(
            {
                "CAMERA_PATH_DATABASE_URL": f"sqlite+aiosqlite:///{directory / 'db.sqlite3'}",
                "CAMERA_PATH_LIBRARY_DIRECTORY": str(directory / "library"),
                "CAMERA_PATH_JWT_SECRET": secrets.token_urlsafe(48),
                "CAMERA_PATH_ENVIRONMENT": "development",
                "CAMERA_PATH_AUTH_SECOND_FACTOR": "email",
                "CAMERA_PATH_AUTH_EMAIL_DELIVERY": "smtp",
                "CAMERA_PATH_AUTH_SMTP_PORT": str(self.mail.server_address[1]),
                "CAMERA_PATH_AUTH_SMTP_HOST": "127.0.0.1",
                "CAMERA_PATH_AWS_LIBRARY_STORAGE": "local",
                "OPENAI_API_KEY": "fixture-not-a-real-key",
                "OPENAI_BASE_URL": f"http://127.0.0.1:{self.llm.server_port}/v1",
            }
        )
        python = str(ROOT / "backend/.venv/bin/python")
        self.command = shlex.split(
            os.environ.get(
                "CP_TEST_SERVER_COMMAND",
                f"{shlex.quote(python)} -m uvicorn camera_path.api:app"
                " --host 127.0.0.1 --port {port}",
            )
        )
        self.command = [arg.replace("{port}", str(port)) for arg in self.command]
        bootstrap = os.environ.get("CP_TEST_BOOTSTRAP_COMMAND")
        if bootstrap is None:
            # Run migrations outside the checkout too: a developer's .env must never be read.
            config = directory / "alembic.ini"
            config.write_text(
                (ROOT / "backend/alembic.ini")
                .read_text()
                .replace(
                    "script_location = alembic",
                    f"script_location = {ROOT / 'backend/alembic'}",
                )
            )
            bootstrap = (
                f"{shlex.quote(python)} -m alembic -c {shlex.quote(str(config))} upgrade head"
            )
        self.bootstrap = shlex.split(bootstrap)
        self.editor_command = shlex.split(
            os.environ.get(
                "CP_TEST_EDITOR_COMMAND",
                f"{shlex.quote(str(ROOT / 'backend/.venv/bin/editor-create'))} {{email}}",
            )
        )
        self.editor_command = [a.replace("{email}", self.email) for a in self.editor_command]
        self.client = httpx.Client(
            base_url=self.url, timeout=15, trust_env=False, event_hooks={"response": [record]}
        )

    def setup(self):
        subprocess.run(
            self.bootstrap,
            cwd=self.directory,
            env=self.env,
            check=True,
            stdout=self.log,
            stderr=self.log,
            timeout=30,
        )
        subprocess.run(
            self.editor_command,
            cwd=self.directory,
            env=self.env,
            check=True,
            input=f"{self.password}\n{self.password}\n",
            text=True,
            stdout=self.log,
            stderr=self.log,
            timeout=30,
            # getpass opens /dev/tty even with piped stdin. Detach from the parent's
            # terminal so the real CLI reads the generated password from stdin.
            start_new_session=True,
        )
        self.start()

    def start(self):
        self.process = subprocess.Popen(
            self.command, cwd=self.directory, env=self.env, stdout=self.log, stderr=self.log
        )
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise RuntimeError("Backend exited; inspect the isolated backend.log")
            try:
                if self.client.get("/health").status_code == 200:
                    return
            except httpx.TransportError:
                pass
            time.sleep(0.05)
        raise TimeoutError("Backend did not become healthy")

    def stop(self):
        if self.process is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)

    def login(self):
        challenge = self.request(
            "POST",
            "/api/v1/auth/login",
            200,
            json={"username": self.email, "password": self.password},
            auth=False,
        )
        assert "access_token" not in challenge.json()
        code = self.mail.code(self.email)
        verified = self.request(
            "POST",
            "/api/v1/auth/verify",
            200,
            json={"challenge_id": challenge.json()["challenge_id"], "code": code},
            auth=False,
        )
        self.token = verified.json()["access_token"]
        return self.token

    def request(self, method, path, expected=200, *, auth=True, **kwargs):
        headers = kwargs.pop("headers", {})
        if auth and self.token:
            headers.setdefault("Authorization", f"Bearer {self.token}")
        response = self.client.request(method, path, headers=headers, **kwargs)
        # Do not print response bodies: login/session responses contain credentials.
        assert response.status_code == expected, (
            method,
            urlsplit(path).path,
            response.status_code,
            expected,
        )
        return response

    def project(self, name="Integration"):
        return Project(
            self, self.request("POST", "/api/v1/projects", 201, json={"name": name}).json()["id"]
        )

    def close(self):
        self.stop()
        self.client.close()
        self.mail.close()
        self.llm.close()
        self.log.close()


class Project:
    def __init__(self, backend, project_id):
        self.backend = backend
        self.path = f"/api/v1/projects/{project_id}"
        self.id = project_id

    def get(self, suffix=""):
        return self.backend.request("GET", self.path + suffix)

    def mutate(self, method, suffix="", expected=200, **kwargs):
        etag = self.get().headers["etag"]
        return self.backend.request(
            method, self.path + suffix, expected, headers={"If-Match": etag}, **kwargs
        )

    def anchor(self, label="A", position=(0, 0, 0)):
        return self.mutate(
            "POST", "/anchors", 201, json={"label": label, "surface_position": position}
        ).json()


@pytest.fixture
def backend(tmp_path):
    backend = Backend(tmp_path)
    try:
        backend.setup()
        yield backend
    finally:
        backend.close()


@pytest.fixture
def editor(backend):
    backend.login()
    return backend


@pytest.fixture(scope="session")
def public_backend(tmp_path_factory):
    backend = Backend(tmp_path_factory.mktemp("public-api"))
    try:
        backend.setup()
        yield backend
    finally:
        backend.close()


@pytest.fixture
def dev_backend(tmp_path):
    backend = Backend(tmp_path)
    backend.env["CAMERA_PATH_MESSAGE_QUEUE"] = "dev"
    backend.env["CAMERA_PATH_LIBRARY_IMPORT_SOURCES"] = json.dumps(
        {
            "incoming": {"driver": "local", "root": str(tmp_path / "incoming")},
        }
    )
    try:
        backend.setup()
        backend.login()
        yield backend
    finally:
        backend.close()
