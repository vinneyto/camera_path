from typing import Annotated

from fastapi import APIRouter, Depends, Request

from camera_path.models import ErrorResponse
from camera_path.routers.auth import AuthenticatedRoute, authenticated
from camera_path.services.user_settings import (
    UserSettings,
    UserSettingsService,
    UserSettingsUpdate,
)

router = APIRouter(route_class=AuthenticatedRoute, prefix="/profile", tags=["Profile"])


def get_current_user_id(request: Request) -> str:
    """Shared published viewer profile; writes are restricted to the editor.

    Preserve the existing profile key so M2 preferences survive the migration.
    Editor localStorage restoration is independent of this backend fallback.
    """
    return request.app.state.dev_user_id


def get_user_settings_service(request: Request) -> UserSettingsService:
    return request.app.state.user_settings_service


CurrentUser = Annotated[str, Depends(get_current_user_id)]
UserSettingsServiceDep = Annotated[UserSettingsService, Depends(get_user_settings_service)]


@router.get(
    "/settings",
    response_model=UserSettings,
    operation_id="getUserSettings",
    description="Read the current user's settings; unset preferences default to enabled.",
)
async def get_user_settings(user_id: CurrentUser, service: UserSettingsServiceDep) -> UserSettings:
    return await service.get(user_id)


@router.patch(
    "/settings",
    response_model=UserSettings,
    operation_id="updateUserSettings",
    description="Save only supplied preferences for the current user, independently of projects.",
    responses={422: {"model": ErrorResponse, "description": "Invalid profile settings."}},
)
@authenticated
async def update_user_settings(
    data: UserSettingsUpdate, user_id: CurrentUser, service: UserSettingsServiceDep
) -> UserSettings:
    return await service.update(user_id, data)
