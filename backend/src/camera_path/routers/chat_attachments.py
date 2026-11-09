from fastapi import APIRouter, Request, Response

from camera_path.models import ChatAttachment
from camera_path.routers.auth import AuthenticatedRoute, authenticated
from camera_path.services.jobs import JobSummary
from camera_path.services.library import LibraryUpload, LibraryUploadCreate

router = APIRouter(route_class=AuthenticatedRoute, tags=["Chat"])


@router.post(
    "/projects/{project_id}/chat/attachments",
    response_model=LibraryUpload,
    status_code=201,
    operation_id="createChatAttachmentUpload",
    description="Stage an original chat image without publishing it in the library.",
)
@authenticated
async def create_attachment(project_id: str, data: LibraryUploadCreate, request: Request):
    return await request.app.state.chat_service.attachments.create(project_id, data, request)


@router.post(
    "/projects/{project_id}/chat/attachments/{attachment_id}/complete",
    response_model=ChatAttachment,
    operation_id="completeChatAttachmentUpload",
    description="Validate a staged image and make it available to this project conversation.",
)
@authenticated
async def complete_attachment(project_id: str, attachment_id: str, request: Request):
    return await request.app.state.chat_service.attachments.complete(project_id, attachment_id)


@router.get(
    "/projects/{project_id}/chat/attachments/{attachment_id}/content",
    operation_id="getChatAttachmentContent",
    description="Read a validated original chat image by its project-scoped attachment ID.",
    response_class=Response,
)
async def attachment_content(project_id: str, attachment_id: str, request: Request):
    data, media_type = await request.app.state.chat_service.attachments.content(
        project_id, attachment_id
    )
    return Response(data, media_type=media_type, headers={"X-Content-Type-Options": "nosniff"})


@router.get(
    "/projects/{project_id}/generation-jobs",
    response_model=list[JobSummary],
    operation_id="listProjectGenerationJobs",
    description="List generation jobs with durable scene-placement intents for this project.",
    tags=["Jobs"],
)
async def list_generation_jobs(project_id: str, request: Request):
    await request.app.state.project_service.get_project(project_id)
    return await request.app.state.job_service.list(project_id)
