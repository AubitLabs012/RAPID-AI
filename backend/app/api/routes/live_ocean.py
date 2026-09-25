from fastapi import APIRouter, HTTPException, status

from app.api.schemas import ApiResponse
from app.services.live_ocean_service import LiveOceanService


router = APIRouter(prefix="/live-ocean", tags=["live-ocean"])


@router.get("/regions", response_model=ApiResponse)
def live_regions() -> ApiResponse:
    try:
        regions = LiveOceanService().regions()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Live ocean feed unavailable: {exc}") from exc
    return ApiResponse(message="Live ocean regions loaded", data={"regions": regions})
