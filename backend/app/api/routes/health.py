from fastapi import APIRouter

from app.api.schemas import ApiResponse


router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=ApiResponse)
def healthcheck() -> ApiResponse:
    return ApiResponse(message="Service healthy", data={"status": "ok"})
