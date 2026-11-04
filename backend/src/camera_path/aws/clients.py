"""AWS SDK construction belongs to the provider/composition layer."""

import asyncio

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from camera_path.services.library_storage import LibraryStorageError


def aws_client(settings, service: str):
    session = boto3.Session(
        profile_name=settings.aws_profile,
        region_name=settings.aws_region or settings.aws_default_region,
        aws_access_key_id=settings.aws_access_key_id.get_secret_value()
        if settings.aws_access_key_id
        else None,
        aws_secret_access_key=settings.aws_secret_access_key.get_secret_value()
        if settings.aws_secret_access_key
        else None,
        aws_session_token=settings.aws_session_token.get_secret_value()
        if settings.aws_session_token
        else None,
    )
    return session.client(
        service,
        config=Config(
            signature_version="s3v4" if service == "s3" else "v4",
            connect_timeout=5,
            read_timeout=30,
            retries={"mode": "standard", "total_max_attempts": 3},
        ),
    )


async def run_io(operation):
    # Cancellation must not race a still-running SDK write with its rollback.
    task = asyncio.create_task(asyncio.to_thread(operation))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        await task
        raise
    except (BotoCoreError, ClientError) as error:
        raise LibraryStorageError("Provider operation unavailable") from error
