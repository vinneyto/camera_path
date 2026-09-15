from fastapi import APIRouter

from camera_path.routers import chat, history, projects, timelines, trajectory

router = APIRouter()
router.include_router(projects.router)
router.include_router(trajectory.router)
router.include_router(timelines.router)
router.include_router(history.router)
router.include_router(chat.router)
