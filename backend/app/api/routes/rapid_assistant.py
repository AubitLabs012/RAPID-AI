"""RAPID disaster-intelligence intake contract.

This route records no incidents and performs no prediction until data providers,
model credentials, and persistence are configured. It exposes the workflow
honestly so the dashboard can connect to a deployed API later.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import get_settings


router = APIRouter(prefix="/assistant", tags=["rapid-assistant"])

STAGES = (
    "Multi-source data",
    "Multimodal AI analysis",
    "Evidence verification",
    "Damage & risk assessment",
    "Geographic intelligence",
    "Incident clustering",
    "Priority engine",
    "Prediction / situation forecast",
    "Response recommendation",
    "Responder dashboard + alerts",
)


class EvidenceReference(BaseModel):
    kind: Literal["text", "image", "video", "document", "satellite", "sensor"]
    label: str = Field(min_length=1, max_length=120)
    # Uploads will be handled by the storage service once its credentials arrive.
    storage_key: str | None = Field(default=None, max_length=512)


class IncidentIntake(BaseModel):
    description: str = Field(min_length=1, max_length=4000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    evidence: list[EvidenceReference] = Field(default_factory=list, max_length=20)


@router.get("/capabilities")
def capabilities() -> dict:
    settings = get_settings()
    return {
        "mode": "configuration_pending",
        "stages": [{"name": name, "status": "pending"} for name in STAGES],
        "connectors": {
            "vision_llm": bool(settings.gemini_api_key or settings.openai_api_key),
            "copernicus": bool(settings.copernicus_endpoint and settings.copernicus_api_key),
            "earthdata": bool(settings.earthdata_token),
            "firms": bool(settings.nasa_firms_key),
            "database": bool(settings.database_url),
            "queue": bool(settings.redis_url),
            "storage": bool(settings.s3_bucket),
        },
        "notice": "Configured credentials do not imply that analysis has run.",
    }


@router.post("/intake")
def intake(payload: IncidentIntake) -> dict:
    if (payload.latitude is None) != (payload.longitude is None):
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="Latitude and longitude must be supplied together")
    return {
        "accepted": False,
        "mode": "configuration_pending",
        "evidence_count": len(payload.evidence),
        "location_provided": payload.latitude is not None,
        "stages": [{"name": name, "status": "pending"} for name in STAGES],
        "message": "The request was validated but not stored or analyzed. Connect the data, model, and storage providers before incident intake is enabled.",
    }
