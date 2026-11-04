"""A disposable real broker; the HTTP test client never imports backend code."""

import base64
import json
import os
import secrets
import socket
import subprocess
import time
from urllib.parse import quote
from uuid import uuid4

import httpx


class RabbitMQ:
    def __init__(self):
        self.name = "camera-path-tests-" + uuid4().hex
        self.password = secrets.token_urlsafe(24)
        self.client = None
        self.container = None

    def start(self):
        ports = {}
        for port in (5672, 15672):
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                ports[port] = listener.getsockname()[1]
        result = subprocess.run(
            [
                "docker",
                "run",
                "--detach",
                "--rm",
                "--name",
                self.name,
                "--hostname",
                "camera-path-tests",
                "--publish",
                f"127.0.0.1:{ports[5672]}:5672",
                "--publish",
                f"127.0.0.1:{ports[15672]}:15672",
                "--env",
                "RABBITMQ_DEFAULT_USER=cp-test",
                "--env",
                f"RABBITMQ_DEFAULT_PASS={self.password}",
                os.environ.get("CP_TEST_RABBITMQ_IMAGE", "rabbitmq:4.2-management"),
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
        if result.returncode:
            raise RuntimeError("RabbitMQ tests require a running Docker engine: " + result.stderr)
        self.container = result.stdout.strip()
        self.url = f"amqp://cp-test:{self.password}@127.0.0.1:{ports[5672]}/"
        self.client = httpx.Client(
            base_url=f"http://127.0.0.1:{ports[15672]}",
            auth=("cp-test", self.password),
            timeout=5,
            trust_env=False,
        )
        self.wait_ready()

    def wait_ready(self):
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            try:
                if self.client.get("/api/overview").status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.2)
        raise TimeoutError("Disposable RabbitMQ did not become healthy")

    def wait_queue(self, queue):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if self.client.get(f"/api/queues/%2F/{quote(queue, safe='')}").status_code == 200:
                return
            time.sleep(0.1)
        raise TimeoutError("Backend did not declare its RabbitMQ queue")

    def publish(self, queue, body, headers=None):
        if not isinstance(body, bytes):
            body = json.dumps(body).encode()
        response = self.client.post(
            "/api/exchanges/%2F/amq.default/publish",
            json={
                "routing_key": queue,
                "properties": {
                    "delivery_mode": 2,
                    "content_type": "application/json",
                    "headers": headers or {},
                },
                "payload": base64.b64encode(body).decode(),
                "payload_encoding": "base64",
            },
        )
        response.raise_for_status()
        assert response.json()["routed"], "Completion was not routed to a queue"

    def get_failure(self, queue, timeout=15):
        return self.get_message(queue + ".failed", timeout=timeout)

    def get_message(self, queue, *, timeout=15, requeue=False):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            response = self.client.post(
                f"/api/queues/%2F/{quote(queue, safe='')}/get",
                json={
                    "count": 1,
                    "ackmode": "ack_requeue_true" if requeue else "ack_requeue_false",
                    "encoding": "base64",
                },
            )
            response.raise_for_status()
            if messages := response.json():
                result = messages[0]
                result["body"] = base64.b64decode(result["payload"])
                return result
            time.sleep(0.1)
        raise TimeoutError("Expected broker message did not arrive")

    def restart(self):
        subprocess.run(
            ["docker", "restart", self.container], check=True, capture_output=True, timeout=60
        )
        self.wait_ready()

    def close(self):
        if self.client is not None:
            self.client.close()
        if self.container is not None:
            subprocess.run(
                ["docker", "rm", "--force", self.container], capture_output=True, timeout=30
            )
