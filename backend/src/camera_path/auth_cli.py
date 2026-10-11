import argparse
import asyncio
import getpass

from camera_path.config import settings
from camera_path.persistence.database import create_engine_and_session_factory
from camera_path.repositories.auth import AuthRepository
from camera_path.services.auth import AuthService
from camera_path.services.auth_email import normalize_email


def run() -> None:
    parser = argparse.ArgumentParser(
        description="Create/replace the single editor and revoke sessions"
    )
    parser.add_argument("username")
    args = parser.parse_args()
    try:
        args.username = normalize_email(args.username)
    except ValueError as error:
        parser.error(str(error))
    password = getpass.getpass("Password: ")
    if not 12 <= len(password) <= 1024:
        parser.error("Password must contain 12–1024 characters")
    if password != getpass.getpass("Repeat password: "):
        parser.error("Passwords do not match")

    async def create() -> None:
        engine, sessions = create_engine_and_session_factory(settings.database_url)
        try:
            await AuthService(AuthRepository(sessions), settings).create_editor(
                args.username, password
            )
        finally:
            await engine.dispose()

    asyncio.run(create())
    print("Editor saved; existing sessions revoked.")
