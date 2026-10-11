"""SES adapter, using the standard AWS credential chain (EC2 role in production)."""

import asyncio

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from camera_path.config import Settings
from camera_path.services.auth_email import AuthEmailError, code_message


class SesAuthEmailSender:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def send_code(self, recipient: str, code: str) -> None:
        def send():
            s = self.settings
            client = boto3.Session(
                profile_name=s.aws_profile,
                region_name=s.aws_region or s.aws_default_region,
                aws_access_key_id=s.aws_access_key_id.get_secret_value()
                if s.aws_access_key_id
                else None,
                aws_secret_access_key=(
                    s.aws_secret_access_key.get_secret_value() if s.aws_secret_access_key else None
                ),
                aws_session_token=s.aws_session_token.get_secret_value()
                if s.aws_session_token
                else None,
            ).client(
                "sesv2",
                config=Config(
                    connect_timeout=5,
                    read_timeout=10,
                    retries={"mode": "standard", "total_max_attempts": 1},
                ),
            )
            client.send_email(
                FromEmailAddress=s.auth_email_from,
                Destination={"ToAddresses": [recipient]},
                Content={
                    "Simple": {
                        "Subject": {"Data": "Camera Path sign-in code", "Charset": "UTF-8"},
                        "Body": {"Text": {"Data": code_message(code), "Charset": "UTF-8"}},
                    }
                },
            )

        try:
            await asyncio.to_thread(send)
        except (BotoCoreError, ClientError) as error:
            raise AuthEmailError("Email delivery failed") from error
