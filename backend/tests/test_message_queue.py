import json
from uuid import uuid4

import pytest

from camera_path.services.library_import_models import LibraryImportMessage
from camera_path.services.library_storage import LibraryStorageError

boto3 = pytest.importorskip("boto3")
from botocore.stub import Stubber  # noqa: E402

from camera_path.aws.message_queue import SQSMessageQueue  # noqa: E402

INPUT = "https://sqs.us-east-1.amazonaws.com/123456789012/imports"
FAILURE = "https://sqs.us-east-1.amazonaws.com/123456789012/failures"


def payload():
    return {
        "schema_version": 1,
        "message_id": str(uuid4()),
        "item": {
            "client_id": str(uuid4()),
            "name": "Item",
            "primary_file_id": "main",
            "files": [
                {
                    "id": "main",
                    "format": "ply",
                    "size_bytes": 4,
                    "sha256": "0" * 64,
                    "source": {"storage": "library", "path": "item.ply"},
                }
            ],
        },
    }


@pytest.fixture
def sqs():
    client = boto3.client(
        "sqs", region_name="us-east-1", aws_access_key_id="fixture", aws_secret_access_key="fixture"
    )
    with Stubber(client) as stub:
        yield SQSMessageQueue(client, INPUT, FAILURE), stub
        stub.assert_no_pending_responses()
    client.close()


def receive(stub, body):
    stub.add_response(
        "receive_message",
        {
            "Messages": [
                {
                    "MessageId": "broker-id",
                    "ReceiptHandle": "receipt",
                    "Body": body,
                    "Attributes": {"ApproximateReceiveCount": "2"},
                }
            ]
        },
        {
            "QueueUrl": INPUT,
            "MaxNumberOfMessages": 1,
            "WaitTimeSeconds": 20,
            "VisibilityTimeout": 60,
            "MessageSystemAttributeNames": ["ApproximateReceiveCount"],
        },
    )


async def test_sqs_same_json_contract_poll_lease_and_commit_ack(sqs):
    queue, stub = sqs
    data = payload()
    receive(stub, json.dumps(data))
    delivery = await queue.receive()
    assert delivery.message == LibraryImportMessage.model_validate(data)
    assert delivery.attempts == 2
    stub.add_response(
        "change_message_visibility",
        {},
        {
            "QueueUrl": INPUT,
            "ReceiptHandle": "receipt",
            "VisibilityTimeout": 60,
        },
    )
    await queue.extend_lease(delivery.receipt)
    stub.add_response("delete_message", {}, {"QueueUrl": INPUT, "ReceiptHandle": "receipt"})
    await queue.ack(delivery.receipt, "asset-id")


async def test_sqs_retry_changes_visibility_without_deleting(sqs):
    queue, stub = sqs
    receive(stub, json.dumps(payload()))
    delivery = await queue.receive()
    stub.add_response(
        "change_message_visibility",
        {},
        {
            "QueueUrl": INPUT,
            "ReceiptHandle": "receipt",
            "VisibilityTimeout": 4,
        },
    )
    await queue.retry(delivery.receipt, 4)


@pytest.mark.parametrize("body", ["not json", '{"Records": []}', '{"schema_version": 999}'])
async def test_invalid_sqs_payload_is_forwarded_before_delete(sqs, body):
    queue, stub = sqs
    receive(stub, body)
    stub.add_response(
        "send_message",
        {"MessageId": "failed-copy"},
        {
            "QueueUrl": FAILURE,
            "MessageBody": body,
            "MessageAttributes": {
                "error_code": {"DataType": "String", "StringValue": "validation_error"}
            },
        },
    )
    stub.add_response("delete_message", {}, {"QueueUrl": INPUT, "ReceiptHandle": "receipt"})
    assert await queue.receive() is None


async def test_failure_queue_outage_does_not_delete_original(sqs):
    queue, stub = sqs
    body = "bad payload"
    receive(stub, body)
    stub.add_client_error(
        "send_message",
        service_error_code="ServiceUnavailable",
        http_status_code=503,
        expected_params={
            "QueueUrl": FAILURE,
            "MessageBody": body,
            "MessageAttributes": {
                "error_code": {"DataType": "String", "StringValue": "validation_error"}
            },
        },
    )
    with pytest.raises(LibraryStorageError):
        await queue.receive()


def test_core_queue_and_import_have_no_provider_imports():
    import ast
    from pathlib import Path

    root = Path("src/camera_path/services")
    for name in (
        "message_queue.py",
        "library_import.py",
        "library_consumer.py",
        "library_import_models.py",
    ):
        tree = ast.parse((root / name).read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or "").startswith(
                    ("camera_path.aws", "camera_path.dev", "boto3", "botocore", "fastapi")
                )
            elif isinstance(node, ast.Import):
                assert not any(
                    n.name.startswith(("boto3", "botocore", "fastapi")) for n in node.names
                )
