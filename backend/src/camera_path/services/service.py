from camera_path.services.chat import ChatService
from camera_path.services.history import HistoryService
from camera_path.services.projects import ProjectService
from camera_path.services.timelines import TimelineService
from camera_path.services.trajectory import TrajectoryEditingService


class TrajectoryService(
    ProjectService,
    TrajectoryEditingService,
    TimelineService,
    ChatService,
    HistoryService,
):
    """Facade exposing the backend application services through one dependency."""
