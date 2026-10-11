"""Loopback-only SMTP sink (e.g. Mailpit) for exercising the actual second step."""

import asyncio
import smtplib
from email.message import EmailMessage

from camera_path.services.auth_email import AuthEmailError, code_message


class SmtpAuthEmailSender:
    def __init__(self, sender: str, host: str, port: int):
        self.sender, self.host, self.port = sender, host, port

    async def send_code(self, recipient: str, code: str) -> None:
        message = EmailMessage()
        message["From"], message["To"] = self.sender, recipient
        message["Subject"] = "Camera Path sign-in code"
        message.set_content(code_message(code))

        def send():
            with smtplib.SMTP(self.host, self.port, timeout=10) as smtp:
                smtp.send_message(message)

        try:
            await asyncio.to_thread(send)
        except (OSError, smtplib.SMTPException) as error:
            raise AuthEmailError("Email delivery failed") from error
