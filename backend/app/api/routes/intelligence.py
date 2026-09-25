from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query

from app.api.dependencies import require_role
from app.api.schemas import ApiResponse
from app.services.etl_service import MarineETLService
from app.services.marine_dashboard import MarineDashboardService


router = APIRouter(tags=["marine-intelligence"])


@router.get("/ocean", response_model=ApiResponse)
async def get_ocean_conditions(limit: int = Query(default=250, ge=1, le=1000)) -> ApiResponse:
    data = await MarineDashboardService().list_ocean(limit=limit)
    return ApiResponse(message="Ocean conditions loaded", data={"items": data})


@router.get("/species", response_model=ApiResponse)
async def get_species(limit: int = Query(default=250, ge=1, le=1000)) -> ApiResponse:
    data = await MarineDashboardService().list_species(limit=limit)
    return ApiResponse(message="Species intelligence loaded", data={"items": data})


@router.get("/predictions", response_model=ApiResponse)
async def get_predictions(limit: int = Query(default=250, ge=1, le=1000)) -> ApiResponse:
    data = await MarineDashboardService().list_predictions(limit=limit)
    return ApiResponse(message="Predictions loaded", data={"items": data})


@router.get("/alerts", response_model=ApiResponse)
async def get_alerts(limit: int = Query(default=250, ge=1, le=1000)) -> ApiResponse:
    data = await MarineDashboardService().list_alerts(limit=limit)
    return ApiResponse(message="Alerts loaded", data={"items": data})


@router.get("/location/{lat}/{lon}", response_model=ApiResponse)
async def get_location(
    lat: float = Path(ge=-90, le=90),
    lon: float = Path(ge=-180, le=180),
) -> ApiResponse:
    data = await MarineDashboardService().location_snapshot(lat, lon)
    return ApiResponse(message="Location intelligence loaded", data=data)


@router.post("/refresh", response_model=ApiResponse)
async def refresh_datasets(_: dict = Depends(require_role("admin"))) -> ApiResponse:
    result = await MarineETLService().refresh()
    return ApiResponse(message="Marine datasets refreshed", data=result)
