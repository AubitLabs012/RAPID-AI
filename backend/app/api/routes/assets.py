from fastapi import APIRouter, Depends

from app.api.dependencies import require_role
from app.api.schemas import ApiResponse, UploadAssetRequest
from app.storage.service import FileStorageService


router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("/upload-url", response_model=ApiResponse)
def create_upload_url(
    payload: UploadAssetRequest,
    _: dict = Depends(require_role("admin")),
    storage_service: FileStorageService = Depends(FileStorageService),
) -> ApiResponse:
    result = storage_service.create_upload_target(payload.filename, payload.content_type)
    return ApiResponse(message="Upload target created", data=result)
