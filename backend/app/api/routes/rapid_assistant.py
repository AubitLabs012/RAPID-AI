"""RAPID assistant chat and disaster-intelligence intake contract."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.integrations.ai_clients import OpenAIClient


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


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    region: str = Field(default="", max_length=100)
    state: str = Field(default="", max_length=100)
    hazard: str = Field(default="", max_length=100)
    risk_score: int | None = Field(default=None, ge=0, le=100)
    scenario_summary: str = Field(default="", max_length=1000)


class AssistantVisionRequest(BaseModel):
    prompt: str = Field(default="Describe visible disaster conditions and damage; separate evidence from uncertainty.", max_length=800)
    image_data_url: str = Field(min_length=32, max_length=7_000_000)


@router.post("/chat")
def chat(payload: AssistantChatRequest) -> dict:
    settings = get_settings()
    if settings.environment != "development":
        raise HTTPException(status_code=404, detail="Not found")
    if settings.ai_provider != "groq" or not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="Groq chat is not configured")

    context = {
        "topic": "RAPID disaster intelligence",
        "response_style": "rapid_assistant",
        "region": payload.region,
        "state": payload.state,
        "hazard": payload.hazard,
        "risk_score": payload.risk_score,
        "scenario_summary": payload.scenario_summary,
    }
    try:
        response = OpenAIClient()._generate_with_groq(payload.message.strip(), context)
    except (ValueError, OSError):
        raise HTTPException(status_code=502, detail="Groq did not return a response. Check the local API key and try again.") from None

    return {"response": response, "model": settings.groq_model, "provider": "groq"}


@router.post("/vision")
def vision(payload: AssistantVisionRequest) -> dict:
    settings = get_settings()
    if settings.environment != "development":
        raise HTTPException(status_code=404, detail="Not found")
    if settings.ai_provider != "groq" or not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="Groq vision is not configured")
    match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})", payload.image_data_url)
    if not match:
        raise HTTPException(status_code=422, detail="Provide a JPEG, PNG, or WebP image")
    try:
        response = OpenAIClient().analyze_image_with_groq(payload.prompt.strip(), payload.image_data_url)
    except (ValueError, OSError):
        raise HTTPException(status_code=502, detail="Image analysis failed. Try a smaller image or retry later.") from None
    return {
        "analysis": response,
        "provider": "groq",
        "model": settings.groq_vision_model,
        "storage": "not_saved_by_rapid",
        "notice": "Image sent to Groq for inference; RAPID does not store it.",
    }


@router.get("/capabilities")
def capabilities() -> dict:
    settings = get_settings()
    return {
        "mode": "development" if settings.environment == "development" else "configuration_pending",
        "chat_enabled": settings.environment == "development" and settings.ai_provider == "groq" and bool(settings.groq_api_key),
        "chat_provider": settings.ai_provider if settings.groq_api_key else None,
        "stages": [{"name": name, "status": "pending"} for name in STAGES],
        "connectors": {
            "vision_llm": settings.ai_provider == "groq" and bool(settings.groq_api_key),
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
