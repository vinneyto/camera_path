from fastapi import APIRouter

from camera_path.routers import (
    anchors,
    chat,
    history,
    projects,
    scene_points,
    timelines,
    trajectory,
)

router = APIRouter()
router.include_router(projects.router)
router.include_router(anchors.router)
router.include_router(scene_points.router)
router.include_router(trajectory.router)
router.include_router(timelines.router)
router.include_router(history.router)
router.include_router(chat.router)
