"""Email delivery contract; codes must never be written to application logs."""

import re
from typing import Protocol


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 128 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise ValueError("A valid email address is required")
    return email


class AuthEmailError(Exception):
    pass


class AuthEmailSender(Protocol):
    async def send_code(self, recipient: str, code: str) -> None: ...


def code_message(code: str) -> str:
    return f"Your Camera Path sign-in code is {code}. It expires in 5 minutes."
