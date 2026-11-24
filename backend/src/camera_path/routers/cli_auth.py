from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, SecretStr

from camera_path.routers.auth import (
    AuthenticatedRoute,
    Credentials,
    authenticated,
    request_source,
)
from camera_path.services.cli_auth import CliAuthService, DeviceGrantError

NO_CACHE = {"Cache-Control": "no-store", "Pragma": "no-cache"}


def get_cli_auth_service(request: Request) -> CliAuthService:
    return request.app.state.cli_auth_service


CliAuthServiceDep = Annotated[CliAuthService, Depends(get_cli_auth_service)]


async def require_cli_worker(service: CliAuthServiceDep, credentials: Credentials) -> str:
    return await service.principal(credentials.credentials if credentials else None)


class DeviceChallenge(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int


class DeviceDecision(BaseModel):
    user_code: str = Field(min_length=8, max_length=9, pattern=r"^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$")
    approve: bool


class DeviceExchange(BaseModel):
    device_code: SecretStr = Field(min_length=43, max_length=43)


class CliToken(BaseModel):
    access_token: str
    token_type: str
    worker_id: str
    expires_in: int
    expires_at: int


class DeviceError(BaseModel):
    error: str


router = APIRouter(prefix="/auth/cli", tags=["CLI authentication"], route_class=AuthenticatedRoute)


@router.post("/device", operation_id="createCliDevice")
async def device(
    service: CliAuthServiceDep, request: Request, response: Response
) -> DeviceChallenge:
    """Issue a short-lived device secret and a separate browser confirmation code."""
    response.headers.update(NO_CACHE)
    return DeviceChallenge(**await service.start_device(request_source(request)))


@router.post("/decision", status_code=204, operation_id="decideCliDevice")
@authenticated
async def decision(
    data: DeviceDecision, service: CliAuthServiceDep, credentials: Credentials, request: Request
) -> None:
    """Approve or deny a displayed device code as the signed-in editor."""
    assert credentials is not None
    await service.decide(
        data.user_code, data.approve, credentials.credentials, request_source(request)
    )


@router.post(
    "/token",
    operation_id="exchangeCliDevice",
    response_model=CliToken,
    responses={400: {"model": DeviceError}},
)
async def token(
    data: DeviceExchange, service: CliAuthServiceDep, request: Request, response: Response
) -> CliToken | JSONResponse:
    """Poll or exchange an approved device secret for a one-time worker session."""
    response.headers.update(NO_CACHE)
    try:
        return CliToken(
            **await service.exchange(data.device_code.get_secret_value(), request_source(request))
        )
    except DeviceGrantError as error:
        headers = dict(NO_CACHE)
        if error.retry_after is not None:
            headers["Retry-After"] = str(error.retry_after)
        return JSONResponse({"error": error.code}, status_code=400, headers=headers)


@router.post("/logout", status_code=204, operation_id="logoutCliWorker")
async def logout(service: CliAuthServiceDep, credentials: Credentials) -> None:
    """Revoke this worker session without signing the editor out of the browser."""
    if credentials is None:
        raise service.editor_auth.unauthorized()
    await service.logout(credentials.credentials)
