import json
import os
import time
import uuid

import boto3
import httpx
import pika
import pytest

from helpers import running
from proxies import AmqpAckFailure, SesCapture, SqsAckFailure

pytestmark = pytest.mark.skipif(
    os.environ.get("CP_TEST_PROVIDERS") != "1", reason="explicit disposable Docker provider profile"
)
AWS = {
    "AWS_ACCESS_KEY_ID": "fixture",
    "AWS_SECRET_ACCESS_KEY": "fixture",
    "AWS_REGION": "us-east-1",
    "AWS_EC2_METADATA_DISABLED": "true",
    "AWS_ENDPOINT_URL": "http://127.0.0.1:35000",
}


def client(service):
    return boto3.client(
        service,
        endpoint_url=AWS["AWS_ENDPOINT_URL"],
        region_name="us-east-1",
        aws_access_key_id="fixture",
        aws_secret_access_key="fixture",
    )


def wait(condition, timeout=20):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if condition():
            return
        time.sleep(0.1)
    raise AssertionError("Condition did not become true")


def envelope(project, name="From queue", key=None):
    return {
        "version": 1,
        "idempotency_key": key or str(uuid.uuid4()),
        "command": {"type": "rename_project", "project_id": project.id, "name": name},
    }


def rabbit_request(method, path, **kwargs):
    response = httpx.request(
        method,
        "http://127.0.0.1:35673/api/" + path,
        auth=("guest", "guest"),
        timeout=5,
        trust_env=False,
        **kwargs,
    )
    assert response.is_success, (method, path, response.status_code)
    return response


def test_rabbitmq_recovers_delivery_after_disconnect_before_ack_and_deduplicates(tmp_path):
    queue = "cp119-" + uuid.uuid4().hex
    proxy = AmqpAckFailure()
    try:
        with running(
            tmp_path,
            extra_env={
                "CAMERA_PATH_QUEUE": "rabbitmq",
                "CAMERA_PATH_QUEUE_NAME": queue,
                "CAMERA_PATH_RABBITMQ_URL": f"amqp://guest:guest@127.0.0.1:{proxy.server_address[1]}/%2f",
            },
        ) as b:
            b.login()
            p = b.project("Original")
            wait(
                lambda: (
                    httpx.get(
                        f"http://127.0.0.1:35673/api/queues/%2f/{queue}",
                        auth=("guest", "guest"),
                        timeout=5,
                    ).status_code
                    == 200
                )
            )
            connection = pika.BlockingConnection(pika.ConnectionParameters("127.0.0.1", 35672))
            channel = connection.channel()
            message = envelope(p)

            def publish(value):
                channel.basic_publish(
                    "",
                    queue,
                    json.dumps(value).encode(),
                    properties=pika.BasicProperties(delivery_mode=2),
                )

            publish(message)
            assert proxy.blocked.wait(15), "Did not intercept a post-commit AMQP Basic.Ack"
            wait(lambda: p.get().json()["name"] == "From queue")
            assert p.get().json()["revision"] == 1
            b.stop()
            b.env["CAMERA_PATH_RABBITMQ_URL"] = "amqp://guest:guest@127.0.0.1:35672/%2f"
            b.start()  # Broker redelivers the unacknowledged message to the fresh process.
            publish(message)
            publish(message)
            wait(
                lambda: rabbit_request("GET", f"queues/%2f/{queue}").json().get("messages", 1) == 0
            )
            assert p.get().json()["revision"] == 1
            publish({**message, "command": {**message["command"], "name": "Wrong reuse"}})
            publish({"malformed": True})
            wait(
                lambda: (
                    rabbit_request("GET", f"queues/%2f/{queue}.dead")
                    .json()
                    .get("messages_ready", 0)
                    >= 2
                )
            )
            assert p.get().json()["name"] == "From queue"
            publish(envelope(p, "Consumer remains usable"))
            wait(lambda: p.get().json()["name"] == "Consumer remains usable")
            assert p.get().json()["revision"] == 2
            connection.close()
    finally:
        proxy.close()
        for suffix in ["", ".dead"]:
            httpx.delete(
                f"http://127.0.0.1:35673/api/queues/%2f/{queue}{suffix}",
                auth=("guest", "guest"),
                timeout=5,
            )
        httpx.delete(
            f"http://127.0.0.1:35673/api/exchanges/%2f/{queue}.dead",
            auth=("guest", "guest"),
            timeout=5,
        )


def test_sqs_recovers_delivery_after_delete_failure_and_deduplicates(tmp_path):
    sqs = client("sqs")
    queue = sqs.create_queue(QueueName="cp119-" + uuid.uuid4().hex)["QueueUrl"]
    dead = sqs.create_queue(QueueName="cp119-dead-" + uuid.uuid4().hex)["QueueUrl"]
    proxy = SqsAckFailure()
    proxy_url = f"http://127.0.0.1:{proxy.server_port}"
    try:
        env = {
            **AWS,
            "AWS_ENDPOINT_URL": proxy_url,
            "CAMERA_PATH_QUEUE": "sqs",
            "CAMERA_PATH_SQS_QUEUE_URL": queue,
            "CAMERA_PATH_SQS_DLQ_URL": dead,
        }
        with running(tmp_path, extra_env=env) as b:
            b.login()
            p = b.project("Original")
            message = envelope(p)
            sqs.send_message(QueueUrl=queue, MessageBody=json.dumps(message))
            assert proxy.blocked.wait(15), "Did not intercept a post-commit SQS DeleteMessage"
            assert p.get().json()["revision"] == 1
            b.stop()
            sqs.change_message_visibility(
                QueueUrl=queue, ReceiptHandle=proxy.receipt, VisibilityTimeout=0
            )
            b.env["AWS_ENDPOINT_URL"] = AWS["AWS_ENDPOINT_URL"]
            b.start()
            sqs.send_message(QueueUrl=queue, MessageBody=json.dumps(message))
            wait(
                lambda: (
                    sqs.get_queue_attributes(
                        QueueUrl=queue,
                        AttributeNames=[
                            "ApproximateNumberOfMessages",
                            "ApproximateNumberOfMessagesNotVisible",
                        ],
                    )["Attributes"]
                    == {
                        "ApproximateNumberOfMessages": "0",
                        "ApproximateNumberOfMessagesNotVisible": "0",
                    }
                )
            )
            assert p.get().json()["revision"] == 1
            bad = {**message, "command": {**message["command"], "name": "Wrong reuse"}}
            for value in [bad, {"malformed": True}]:
                sqs.send_message(QueueUrl=queue, MessageBody=json.dumps(value))
            wait(
                lambda: (
                    int(
                        sqs.get_queue_attributes(
                            QueueUrl=dead, AttributeNames=["ApproximateNumberOfMessages"]
                        )["Attributes"]["ApproximateNumberOfMessages"]
                    )
                    >= 2
                )
            )
            assert p.get().json()["name"] == "From queue"
            sqs.send_message(QueueUrl=queue, MessageBody=json.dumps(envelope(p, "After rejection")))
            wait(lambda: p.get().json()["name"] == "After rejection")
            assert p.get().json()["revision"] == 2
    finally:
        proxy.close()
        sqs.delete_queue(QueueUrl=queue)
        sqs.delete_queue(QueueUrl=dead)


def test_s3_presigned_upload_is_promoted_and_cannot_overwrite_ready_asset(tmp_path):
    s3 = client("s3")
    bucket = "cp119-" + uuid.uuid4().hex
    s3.create_bucket(Bucket=bucket)
    try:
        with running(
            tmp_path,
            extra_env={
                **AWS,
                "CAMERA_PATH_AWS_LIBRARY_STORAGE": "s3",
                "CAMERA_PATH_AWS_S3_BUCKET": bucket,
            },
        ) as b:
            b.login()
            data = b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"
            pending = b.request(
                "POST",
                "/api/v1/library/uploads",
                201,
                json={"name": "S3 fixture", "size_bytes": len(data)},
            ).json()
            assert httpx.put(pending["upload_url"], content=data, timeout=10).is_success
            base = f"/api/v1/library/{pending['id']}"
            ready = b.request("POST", base + "/complete").json()
            assert httpx.get(ready["download_url"], timeout=10).content == data
            httpx.put(pending["upload_url"], content=b"wrong", timeout=10).raise_for_status()
            assert httpx.get(ready["download_url"], timeout=10).content == data
            p = b.project()
            p.mutate("POST", "/clouds", 201, json={"library_asset_id": ready["id"]})
            b.request("DELETE", base, 204)
            assert p.get("/clouds").json() == []
            assert s3.list_objects_v2(Bucket=bucket).get("Contents", []) == []
    finally:
        for item in s3.list_objects_v2(Bucket=bucket).get("Contents", []):
            s3.delete_object(Bucket=bucket, Key=item["Key"])
        s3.delete_bucket(Bucket=bucket)


def test_ses_delivers_real_message_to_emulated_provider_before_verification(tmp_path):
    ses = client("sesv2")
    sender = "cp119-" + uuid.uuid4().hex + "@example.test"
    ses.create_email_identity(EmailIdentity=sender)
    capture = SesCapture()
    try:
        with running(
            tmp_path,
            extra_env={
                **AWS,
                "CAMERA_PATH_AUTH_EMAIL_DELIVERY": "ses",
                "CAMERA_PATH_AUTH_EMAIL_FROM": sender,
                "AWS_ENDPOINT_URL": f"http://127.0.0.1:{capture.server_port}",
            },
        ) as b:
            challenge = b.request(
                "POST", "/api/v1/auth/login", json={"username": b.email, "password": b.password}
            ).json()
            message = capture.messages.get(timeout=5)
            assert message["FromEmailAddress"] == sender
            assert message["Destination"]["ToAddresses"] == [b.email]
            import re

            code = re.search(r"\b(\d{6})\b", message["Content"]["Simple"]["Body"]["Text"]["Data"])[
                1
            ]
            result = b.request(
                "POST",
                "/api/v1/auth/verify",
                json={"challenge_id": challenge["challenge_id"], "code": code},
            ).json()
            b.token = result["access_token"]
            b.request("GET", "/api/v1/auth/session")
    finally:
        capture.close()
        ses.delete_email_identity(EmailIdentity=sender)
