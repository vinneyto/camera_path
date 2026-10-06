from collections.abc import Callable
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, SecretStr

from camera_path.services.auth import AuthService

bearer = HTTPBearer(auto_error=False)
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth_service


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def require_editor(service: AuthServiceDep, credentials: Credentials) -> str:
    username, _ = await service.principal(credentials.credentials if credentials else None)
    return username


def authenticated(route: Callable) -> Callable:
    """Common route decorator: authenticate before validation/mutation dependencies."""

    def decorate(*args: Any, **kwargs: Any) -> Callable:
        kwargs["dependencies"] = [Depends(require_editor), *kwargs.get("dependencies", [])]
        kwargs["responses"] = {
            **kwargs.get("responses", {}),
            401: {"description": "Valid editor JWT required."},
        }
        return route(*args, **kwargs)

    return decorate


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: SecretStr = Field(min_length=1, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class SessionResponse(BaseModel):
    username: str


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    operation_id="loginEditor",
    summary="Sign in as the editor",
    description="Verify credentials and issue a revocable JWT.",
)
async def login(data: LoginRequest, service: AuthServiceDep) -> TokenResponse:
    token, expires = await service.login(data.username, data.password.get_secret_value())
    return TokenResponse(access_token=token, expires_in=expires)


@router.get(
    "/session",
    response_model=SessionResponse,
    operation_id="getEditorSession",
    summary="Read the editor session",
    description="Validate the JWT and return the editor name.",
)
async def current_session(username: Annotated[str, Depends(require_editor)]) -> SessionResponse:
    return SessionResponse(username=username)


@authenticated(router.post)(
    "/logout",
    status_code=204,
    operation_id="logoutEditor",
    summary="Sign out",
    description="Revoke the current JWT session on the server.",
)
async def logout(service: AuthServiceDep, credentials: Credentials) -> None:
    assert credentials is not None
    await service.logout(credentials.credentials)
