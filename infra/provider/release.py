"""Asynchronous CloudFormation provider: wait for SSM and for the real release result."""
import base64
import hashlib
import json
import re
import shlex

import boto3
from botocore.exceptions import ClientError


def on_event(event, context):
    return {"PhysicalResourceId": event.get("PhysicalResourceId", "backend-release")}


def is_complete(event, context):
    if event["RequestType"] == "Delete":
        return {"IsComplete": True}  # Never destroy application data from this hook.
    props = event["ResourceProperties"]
    revision = props["Revision"]
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Invalid commit SHA")
    # Validate the payload before constructing a shell command.
    base64.b64decode(props["Script"], validate=True)
    ssm = boto3.client("ssm")
    instance = props["InstanceId"]
    comment = "camera-path-" + event["RequestId"]
    commands = []
    for page in ssm.get_paginator("list_commands").paginate(InstanceId=instance):
        commands.extend(c for c in page["Commands"] if c.get("Comment") == comment)
    if not commands:
        nodes = ssm.describe_instance_information(
            Filters=[{"Key": "InstanceIds", "Values": [instance]}]
        )["InstanceInformationList"]
        if not nodes or nodes[0]["PingStatus"] != "Online":
            return {"IsComplete": False}
        script = (
            "set -eu\n"
            "timeout 1200 sh -c 'until test -f /etc/camera-path/bootstrap-ready; do sleep 5; done'\n"
            f"printf %s {shlex.quote(base64.b64encode(json.dumps(props['Config']).encode()).decode())}"
            " | base64 -d > /etc/camera-path/deployment.json\n"
            f"printf %s {shlex.quote(props['Script'])} | base64 -d > /etc/camera-path/release-"
            f"{hashlib.sha256(event['RequestId'].encode()).hexdigest()}.py\n"
            "/opt/camera-path-tools/bin/python /etc/camera-path/release-"
            f"{hashlib.sha256(event['RequestId'].encode()).hexdigest()}.py {revision}\n"
        )
        ssm.send_command(
            InstanceIds=[instance], DocumentName="AWS-RunShellScript", Comment=comment,
            TimeoutSeconds=1200,
            Parameters={"commands": [script], "executionTimeout": ["3000"]},
        )
        return {"IsComplete": False}
    command_id = commands[0]["CommandId"]
    try:
        invocation = ssm.get_command_invocation(CommandId=command_id, InstanceId=instance)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "InvocationDoesNotExist":
            return {"IsComplete": False}
        raise
    status = invocation["Status"]
    if status == "Success":
        return {"IsComplete": True}
    if status in {"Pending", "InProgress", "Delayed", "Cancelling"}:
        return {"IsComplete": False}
    # Do not copy command output into CloudFormation. Inspect SSM for the detailed log.
    raise RuntimeError(f"Backend release failed: SSM command {command_id}, status {status}")
