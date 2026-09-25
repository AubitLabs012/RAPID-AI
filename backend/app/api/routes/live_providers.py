"""Only the Windy browser Maps credential is shared with its client SDK."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import get_settings

router = APIRouter(prefix="/live", tags=["live-imagery"])


@router.get("/providers")
def providers() -> JSONResponse:
    settings = get_settings()
    return JSONResponse(
        {
            "nasa": {
                "configured": bool(settings.nasa_api_key),
                "imagery_requires_key": False,
            },
            "windy": {
                "configured": bool(settings.windy_maps_api_key),
                "maps_key": settings.windy_maps_api_key,
            },
        },
        headers={"Cache-Control": "no-store"},
    )
