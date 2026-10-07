from typing import Literal

from pydantic import BaseModel, ConfigDict, StrictBool
from sqlalchemy.exc import IntegrityError

from camera_path.repositories.user_settings import UserSettingsRepository


class UserSettings(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    webgpu_tile_renderer: bool
    show_grid: bool
    gaussian_dpr: Literal["1x", "system"] = "1x"


class UserSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Defaults allow omitted PATCH fields; exclude_unset keeps them out of the write.
    webgpu_tile_renderer: StrictBool = True
    show_grid: StrictBool = True
    gaussian_dpr: Literal["1x", "system"] = "1x"


class UserSettingsService:
    def __init__(self, repository: UserSettingsRepository) -> None:
        self.repository = repository

    async def get(self, user_id: str) -> UserSettings:
        record = await self.repository.get(user_id)
        return (
            UserSettings.model_validate(record)
            if record is not None
            else UserSettings(webgpu_tile_renderer=True, show_grid=True)
        )

    async def update(self, user_id: str, data: UserSettingsUpdate) -> UserSettings:
        changes = data.model_dump(exclude_unset=True)
        try:
            async with self.repository.sessions.begin() as session:
                record = await self.repository.update(session, user_id, changes)
        except IntegrityError:
            # Two clients may create the same user's first settings row at once.
            # Retry the partial update in a new transaction after the insert rollback.
            async with self.repository.sessions.begin() as session:
                record = await self.repository.update(session, user_id, changes)
        return UserSettings.model_validate(record)
