import argparse
import asyncio
import hashlib
import os
import sys
import time
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from .models import LocalModels, download_weights
from .worker import run_worker


@dataclass(frozen=True)
class Profile:
    name: str
    web: str
    api: str

    @property
    def credential_key(self):
        return f"{self.name}:{hashlib.sha256(self.api.encode()).hexdigest()}"

    @classmethod
    def from_name(cls, name):
        dev = name == "dev"
        web_port = os.getenv("CAMERA_PATH_DEV_FRONTEND_PORT", "3000")
        api_port = os.getenv("CAMERA_PATH_DEV_BACKEND_PORT", "8000")
        prefix = f"CAMERA_PATH_CLI_{name.upper()}"
        web = os.getenv(
            f"{prefix}_WEB_URL",
            (f"http://127.0.0.1:{web_port}" if dev else "https://camerapath.dev"),
        ).rstrip("/")
        api = os.getenv(
            f"{prefix}_API_URL",
            (f"http://127.0.0.1:{api_port}" if dev else "https://api.camerapath.dev"),
        ).rstrip("/")
        for url in (web, api):
            parsed = urlsplit(url)
            loopback = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
            if (
                not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or not (parsed.scheme == "https" or (dev and loopback and parsed.scheme == "http"))
            ):
                raise ValueError("Use HTTPS endpoints, or HTTP loopback for the dev profile")
        if not api.endswith("/api/v1"):
            api += "/api/v1"
        return cls(name, web, api)


def keychain():
    if sys.platform != "darwin":
        raise SystemExit("CLI credentials require macOS Keychain.")
    from keyring.backends.macOS import Keyring

    return Keyring()


SERVICE = "Camera Path CLI"


def login(client, profile, store, *, browser=webbrowser.open, sleep=time.sleep):
    response = client.post("auth/cli/device")
    response.raise_for_status()
    device = response.json()
    uri = device["verification_uri_complete"]
    target = urlsplit(uri)
    expected = urlsplit(profile.web)
    if (target.scheme, target.netloc) != (expected.scheme, expected.netloc):
        raise ValueError("Device verification URL does not match this profile's web origin")
    print(f"Open {device['verification_uri']} and confirm code {device['user_code']}.")
    browser(uri)
    interval = max(float(device["interval"]), 1)
    deadline = time.monotonic() + float(device["expires_in"])
    while time.monotonic() + interval < deadline:
        sleep(interval)
        try:
            response = client.post("auth/cli/token", json={"device_code": device["device_code"]})
        except httpx.TransportError:
            interval = min(interval * 2, 60)
            continue
        if response.is_success:
            data = response.json()
            token = data.get("access_token") or data.get("token") or data.get("bearer")
            if not isinstance(token, str) or not token:
                raise ValueError("Device authorization did not return a worker credential")
            store.set_password(SERVICE, profile.credential_key, token)
            print(f"Signed in to {profile.name}.")
            return
        data = response.json()
        error = data.get("error") or data.get("code")
        if error == "authorization_pending":
            continue
        if error == "slow_down" or response.status_code == 429:
            interval += 5
            continue
        if error == "access_denied":
            raise ValueError("Device authorization was declined.")
        if error == "expired_token":
            break
        response.raise_for_status()
    raise ValueError("Device code expired. Run login again.")


def find_repo(root):
    for candidate in (Path(root).resolve(), *Path(root).resolve().parents):
        if all(
            (candidate / name / "pyproject.toml").is_file() for name in ("painter", "generation")
        ):
            return candidate
    raise ValueError("Run from a Camera Path repository checkout or provide --repo.")


def main():
    parser = argparse.ArgumentParser(description="Run Camera Path inference on a local Mac.")
    parser.add_argument("--profile", choices=("dev", "prod"), default="prod")
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("command", choices=("login", "worker", "logout", "download-weights"))
    args = parser.parse_args()
    try:
        profile = Profile.from_name(args.profile)
        if args.command == "download-weights":
            download_weights(find_repo(args.repo))
            return
        store = keychain()
        token = store.get_password(SERVICE, profile.credential_key)
        if args.command == "login":
            if token is not None:
                raise ValueError("A session already exists for this profile. Log out first.")
            with httpx.Client(base_url=profile.api, timeout=15, trust_env=False) as client:
                login(client, profile, store)
            return
        if token is None:
            raise ValueError(f"Not signed in to {profile.name}. Run login first.")
        if args.command == "logout":
            with httpx.Client(base_url=profile.api, timeout=15, trust_env=False) as client:
                response = client.post(
                    "auth/cli/logout", headers={"Authorization": f"Bearer {token}"}
                )
                if response.status_code != 401:
                    response.raise_for_status()
            store.delete_password(SERVICE, profile.credential_key)
            print(f"Signed out of {profile.name}.")
            return
        asyncio.run(run_worker(profile, token, LocalModels(find_repo(args.repo))))
    except KeyboardInterrupt:
        pass
    except httpx.HTTPStatusError as error:
        raise SystemExit(
            f"Camera Path request failed (HTTP {error.response.status_code})."
        ) from None
    except httpx.TransportError:
        raise SystemExit("Could not connect to Camera Path for this profile.") from None
    except (ValueError, RuntimeError) as error:
        raise SystemExit(str(error)) from None


if __name__ == "__main__":
    main()
