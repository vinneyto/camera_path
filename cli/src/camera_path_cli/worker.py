"""One serial worker, with command delivery over WS and attempt operations over REST."""

import asyncio
import fcntl
import hashlib
import json
import shutil
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID, uuid4, uuid5

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus

HEARTBEAT_SECONDS = 30
MAX_SOURCE_SIZE = 20 * 1024**2


def origin(url):
    u = urlsplit(str(url))
    return u.scheme, u.hostname, u.port or (443 if u.scheme == "https" else 80)


def file_metadata(path, file_id):
    with path.open("rb") as fh:
        digest = hashlib.file_digest(fh, "sha256").hexdigest()
    return {
        "file_id": file_id,
        "format": path.suffix.removeprefix("."),
        "size_bytes": path.stat().st_size,
        "sha256": digest,
    }


def attempt_uuid(value):
    return str(UUID(value))


def save_json(path, value):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value), encoding="utf-8")
    tmp.replace(path)


class InferenceConnection:
    def __init__(self, profile, token, client, models, state):
        self.profile = profile
        self.authorization = {"Authorization": f"Bearer {token}"}
        self.client = client
        self.models = models
        self.state = state
        self.pending = state / "pending.json"

    async def request(self, method, path, **kwargs):
        response = await self.client.request(method, path, headers=self.authorization, **kwargs)
        response.raise_for_status()
        return response

    async def retry(self, action):
        delay = 1
        while True:
            try:
                return await action()
            except httpx.HTTPStatusError as error:
                if error.response.status_code not in {408, 429, 500, 502, 503, 504}:
                    raise
            except httpx.TransportError:
                pass
            await asyncio.sleep(delay)
            delay = min(delay * 2, 15)

    async def transfer_source(self, job, attempt, source, path):
        if isinstance(source, dict):
            source = source.get("url") or source.get("download_url")
        if source:
            url = self.client.base_url.join(source)
            if origin(url) != origin(self.profile.api) or not url.path.endswith(
                f"/inference/jobs/{job}/source-image"
            ):
                raise ValueError("Source image URL is outside this job's API.")
        else:
            url = self.client.base_url.join(f"inference/jobs/{job}/source-image")
        url = url.copy_merge_params({"attempt_id": attempt})
        async with self.client.stream("GET", url, headers=self.authorization) as response:
            response.raise_for_status()
            digest = hashlib.sha256()
            temporary = path.with_suffix(".tmp")
            try:
                with temporary.open("wb") as output:
                    size = 0
                    async for block in response.aiter_bytes():
                        size += len(block)
                        if size > MAX_SOURCE_SIZE:
                            raise ValueError("Source image exceeds the size limit.")
                        output.write(block)
                        digest.update(block)
                temporary.replace(path)
            finally:
                temporary.unlink(missing_ok=True)
        return digest.hexdigest()

    async def _put(self, reservation, path):
        url = self.client.base_url.join(reservation["upload_url"])
        headers = dict(reservation.get("headers") or {})
        if any(key.lower() == "authorization" for key in headers):
            raise ValueError("Unexpected authorization header in an upload reservation.")
        if origin(url) == origin(self.profile.api):
            if not url.path.startswith("/api/v1/inference/jobs/"):
                raise ValueError("Local upload isn't an inference route.")
            headers.update(self.authorization)
        elif url.scheme != "https" or url.username or url.password:
            raise ValueError("Upload URL must be HTTPS.")
        # The reservation supplies Content-Length; the producer also supplies it for
        # local endpoints which do not set a signed length header.
        if not any(k.lower() == "content-length" for k in headers):
            headers["Content-Length"] = str(path.stat().st_size)

        async def chunks():
            with path.open("rb") as file:
                while block := await asyncio.to_thread(file.read, 1024**2):
                    yield block

        response = await self.client.put(url, content=chunks(), headers=headers)
        response.raise_for_status()

    async def publish(self, prefix, attempt, result, paths, receipt_path):
        # Stable by attempt and file name, including when restarting after a lost response.
        file_ids = {path: str(uuid5(UUID(attempt), path.name)) for path in paths}
        files = [await asyncio.to_thread(file_metadata, path, file_ids[path]) for path in paths]
        while True:
            reservation = (
                await self.request(
                    "POST", f"{prefix}/uploads", json={"attempt_id": attempt, "files": files}
                )
            ).json()
            returned_ids = reservation["files"]
            reservations = {item["file_id"]: item for item in returned_ids}
            if set(reservations) != set(file_ids.values()):
                raise ValueError("Unexpected set of upload reservations.")
            try:
                for path in paths:
                    await self._put(reservations[file_ids[path]], path)
                break
            except httpx.HTTPStatusError as error:
                if error.response.status_code != 403 or origin(error.request.url) == origin(
                    self.profile.api
                ):
                    raise
                # A presigned URL may expire during a long job. Reserve again; the
                # backend reuses the identifiers and refreshes expiring signatures.
                await asyncio.sleep(5)
        uploads = [reservations[file_ids[path]]["upload_id"] for path in paths]
        body = {"attempt_id": attempt}
        if paths[0].suffix == ".png":
            body["image_upload_id"] = uploads[0]
        else:
            body["assets"] = [
                {
                    "name": "Trellis",
                    "bbox": result["bbox"],
                    "primary_upload_id": uploads[0],
                    "upload_ids": uploads,
                }
            ]
        save_json(receipt_path, {"manifest": body})
        return body

    async def heartbeat(self, prefix, attempt, work):
        while not work.done():
            await asyncio.sleep(HEARTBEAT_SECONDS)
            if work.done():
                return
            await self.retry(
                lambda: self.request("POST", f"{prefix}/heartbeat", json={"attempt_id": attempt})
            )

    async def process(self, offer):
        job = attempt_uuid(offer["job_id"])
        prefix = f"inference/jobs/{job}"
        if self.pending.is_file():
            state = json.loads(self.pending.read_text())
            if state["job_id"] != job:
                raise RuntimeError("Another local job is pending acknowledgement.")
        else:
            state = {"job_id": job, "claim_id": str(uuid4())}
            save_json(self.pending, state)
        # A known attempt can be resumed using the local journal even if the server
        # already committed complete and the HTTP response was lost.
        job_dir = self.state / job
        job_dir.mkdir(mode=0o700, exist_ok=True)
        try:
            if "attempt" in state:
                claim = state["attempt"]
            else:
                claim = (
                    await self.retry(
                        lambda: self.request(
                            "POST",
                            f"{prefix}/claim",
                            json={"claim_id": state["claim_id"]},
                        )
                    )
                ).json()
                state["attempt"] = claim
                save_json(self.pending, state)
            attempt = attempt_uuid(claim["attempt_id"])
            receipt_path = job_dir / f"{attempt}.receipt.json"

            async def run():
                if receipt_path.is_file():
                    receipt = json.loads(receipt_path.read_text())
                else:
                    await self.retry(
                        lambda: self.request(
                            "POST", f"{prefix}/heartbeat", json={"attempt_id": attempt}
                        )
                    )
                    receipt = await self.infer(job, claim, job_dir)
                    save_json(receipt_path, receipt)
                if "error" in receipt:
                    await self.retry(
                        lambda: self.request(
                            "POST",
                            f"{prefix}/fail",
                            json={"attempt_id": attempt, "error": receipt["error"]},
                        )
                    )
                else:
                    manifest = receipt["manifest"]
                    if (
                        manifest.get("upload_ids")
                        or manifest.get("image_upload_id")
                        or manifest.get("assets")
                    ):
                        # Terminal retry must use the exact manifest saved before sending complete.
                        await self.retry(
                            lambda: self.request("POST", f"{prefix}/complete", json=manifest)
                        )
                    else:
                        try:
                            body = await self.retry(
                                lambda: self.prepare_uploads(
                                    prefix, attempt, manifest, receipt_path
                                )
                            )
                            await self.retry(
                                lambda: self.request("POST", f"{prefix}/complete", json=body)
                            )
                        except httpx.HTTPStatusError as error:
                            if error.response.status_code != 422:
                                raise
                            failure = {
                                "code": "invalid_artifact",
                                "message": "Server rejected the generated artifact.",
                            }
                            save_json(receipt_path, {"error": failure})
                            await self.retry(
                                lambda: self.request(
                                    "POST",
                                    f"{prefix}/fail",
                                    json={"attempt_id": attempt, "error": failure},
                                )
                            )

            work = asyncio.create_task(run())
            heartbeat = asyncio.create_task(self.heartbeat(prefix, attempt, work))
            try:
                done, _ = await asyncio.wait({work, heartbeat}, return_when=asyncio.FIRST_COMPLETED)
                if work in done:
                    work.result()
                else:
                    heartbeat.result()
                    await work
            finally:
                for task in (heartbeat, work):
                    if not task.done():
                        task.cancel()
                await asyncio.gather(heartbeat, work, return_exceptions=True)
        except httpx.HTTPStatusError as error:
            if error.response.status_code not in {404, 409}:
                raise
            print(f"Job {job}: claim or lease is no longer active.", flush=True)
        # Clear the journal only on a definite terminal response or stale attempt.
        self.pending.unlink(missing_ok=True)
        shutil.rmtree(job_dir)

    async def infer(self, job, claim, job_dir):
        attempt = attempt_uuid(claim["attempt_id"])
        command = claim["command"]
        params = dict(claim["input"])
        source = params.pop("source_image", None)
        try:
            if source:
                path = job_dir / f"{attempt}.source"
                digest = await self.retry(lambda: self.transfer_source(job, attempt, source, path))
                params.update(image_path=str(path), image_sha256=digest)
            result = await self.models.run(command, attempt, params, job_dir)
            if result["status"] != "succeeded":
                return {"error": result["error"]}
            artifact = job_dir / attempt
            if command == "generate_image":
                paths = [artifact / "image.png"]
                bbox = None
            else:
                manifest = json.loads((artifact / "result.json").read_text())
                paths = [artifact / "asset.ply"]
                bbox = manifest["bbox"]
            return {"manifest": {"paths": [str(path) for path in paths], "bbox": bbox}}
        except (OSError, RuntimeError, ValueError, KeyError):
            return {
                "error": {"code": "local_inference_failed", "message": "The local model failed."}
            }

    async def prepare_uploads(self, prefix, attempt, manifest, receipt_path):
        return await self.publish(
            prefix, attempt, manifest, [Path(p) for p in manifest["paths"]], receipt_path
        )

    async def listen(self, capabilities):
        root = urlsplit(self.profile.api)
        websocket = root._replace(
            scheme="wss" if root.scheme == "https" else "ws",
            path=root.path.rstrip("/") + "/inference/commands",
        ).geturl()
        delay = 1
        while True:
            try:
                await self.request(
                    "PUT",
                    "inference/worker",
                    json={"schema_version": 1, "capabilities": capabilities},
                )
                async with connect(
                    websocket,
                    additional_headers=self.authorization,
                    proxy=None,
                    ping_interval=20,
                    ping_timeout=20,
                    max_size=64 * 1024,
                ) as commands:
                    delay = 1
                    print(
                        f"Connected to {self.profile.name} ({', '.join(capabilities)}).", flush=True
                    )
                    if self.pending.is_file():
                        await self.process(json.loads(self.pending.read_text()))
                    async for message in commands:
                        try:
                            event = json.loads(message)
                            if (
                                event["schema_version"] != 1
                                or event["type"] != "command.available"
                                or event["command"] not in capabilities
                            ):
                                continue
                            attempt_uuid(event["job_id"])
                        except (KeyError, TypeError, ValueError):
                            continue
                        await self.process(event)
            except InvalidStatus as error:
                if error.response.status_code in {401, 403}:
                    raise RuntimeError(
                        "Worker session expired or was revoked. Run logout then login."
                    ) from None
            except ConnectionClosed as error:
                if error.rcvd is not None and error.rcvd.code in {1008, 4401, 4403}:
                    raise RuntimeError(
                        "Worker session expired or was revoked. Run logout then login."
                    ) from None
            except httpx.HTTPStatusError as error:
                if error.response.status_code in {401, 403}:
                    raise RuntimeError(
                        "Worker session expired or was revoked. Run logout then login."
                    ) from None
                if error.response.status_code < 500 and error.response.status_code not in {
                    408,
                    429,
                }:
                    raise
            except (OSError, TimeoutError, httpx.TransportError):
                pass
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)


async def run_worker(profile, token, models):
    status = await models.readiness()
    if not status:
        raise RuntimeError("No local models are ready. Run camera-path download-weights first.")
    state = Path.home() / ".camera-path" / "cli" / profile.credential_key.replace(":", "-")
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / "lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("An inference worker is already running for this profile.") from None
        async with httpx.AsyncClient(base_url=profile.api, timeout=30, trust_env=False) as http:
            await InferenceConnection(profile, token, http, models, state).listen(status)
