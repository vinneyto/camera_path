from collections.abc import Callable
from typing import Annotated, Any, TypeVar

from fastapi import APIRouter, Depends, Request
from fastapi.routing import APIRoute
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


Endpoint = TypeVar("Endpoint", bound=Callable[..., Any])


def authenticated(endpoint: Endpoint) -> Endpoint:
    """Mark an endpoint before its @router decorator registers it."""
    endpoint.__requires_editor__ = True
    return endpoint


class AuthenticatedRoute(APIRoute):
    """Translate @authenticated into a normal FastAPI dependency at registration."""

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        if getattr(endpoint, "__requires_editor__", False):
            dependencies = kwargs.get("dependencies") or []
            kwargs["dependencies"] = [
                Depends(require_editor),
                *(dep for dep in dependencies if dep.dependency is not require_editor),
            ]
            kwargs["responses"] = {
                **(kwargs.get("responses") or {}),
                401: {"description": "Valid editor JWT required."},
            }
        super().__init__(path, endpoint, **kwargs)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: SecretStr = Field(min_length=1, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ChallengeResponse(BaseModel):
    challenge_id: str
    expires_in: int
    resend_after: int


class ChallengeRequest(BaseModel):
    challenge_id: str = Field(min_length=32, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class VerifyRequest(ChallengeRequest):
    code: SecretStr = Field(min_length=6, max_length=6)


def request_source(request: Request) -> str:
    # Use the immediate peer, never client-supplied X-Forwarded-For.
    # Behind Next/Nginx this deliberately shares a conservative proxy budget.
    return request.client.host if request.client else "unknown"


class SessionResponse(BaseModel):
    username: str


router = APIRouter(prefix="/auth", tags=["Auth"], route_class=AuthenticatedRoute)


@router.post(
    "/login",
    response_model=TokenResponse | ChallengeResponse,
    operation_id="loginEditor",
    summary="Sign in as the editor",
    description="Verify email/password and send a code; no JWT until confirmation.",
)
async def login(
    data: LoginRequest, service: AuthServiceDep, request: Request
) -> TokenResponse | ChallengeResponse:
    result = await service.login(
        data.username, data.password.get_secret_value(), request_source(request)
    )
    return TokenResponse(**result) if "access_token" in result else ChallengeResponse(**result)


@router.post(
    "/verify",
    response_model=TokenResponse,
    operation_id="verifyEditorCode",
    summary="Confirm the one-time email code",
)
async def verify(data: VerifyRequest, service: AuthServiceDep, request: Request) -> TokenResponse:
    """Consume an unexpired one-time email code and issue the editor JWT."""
    return TokenResponse(
        **await service.verify(
            data.challenge_id, data.code.get_secret_value(), request_source(request)
        )
    )


@router.post(
    "/resend",
    response_model=ChallengeResponse,
    operation_id="resendEditorCode",
    summary="Replace and resend the email code",
)
async def resend(
    data: ChallengeRequest, service: AuthServiceDep, request: Request
) -> ChallengeResponse:
    """Replace the code after cooldown; preserve failed-attempt and sending budgets."""
    return ChallengeResponse(**await service.resend(data.challenge_id, request_source(request)))


@router.get(
    "/session",
    response_model=SessionResponse,
    operation_id="getEditorSession",
    summary="Read the editor session",
    description="Validate the JWT and return the editor name.",
)
async def current_session(username: Annotated[str, Depends(require_editor)]) -> SessionResponse:
    return SessionResponse(username=username)


@router.post(
    "/logout",
    status_code=204,
    operation_id="logoutEditor",
    summary="Sign out",
    description="Revoke the current JWT session on the server.",
)
@authenticated
async def logout(service: AuthServiceDep, credentials: Credentials) -> None:
    assert credentials is not None
    await service.logout(credentials.credentials)
