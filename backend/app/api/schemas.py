from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ApiResponse(BaseModel):
    success: bool = True
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern="^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="user", pattern="^(admin|user)$")


class SignupRequest(LoginRequest):
    display_name: str = Field(min_length=1, max_length=80)


class TokenPayload(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict[str, Any]


class AIResponseRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    use_voice: bool = False
    context: dict[str, Any] = Field(default_factory=dict)


class PredictionAgentRequest(BaseModel):
    agent_id: Literal["marine", "analytics", "reasoning", "intelligence", "synthesis"]
    prompt: str = Field(min_length=1, max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)


class GameActionRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    game_type: str = Field(min_length=1, max_length=64)
    result: str = Field(pattern="^(win|lose|draw)$")
    score: int = Field(ge=0, le=1_000_000)


class UploadAssetRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=256)
    content_type: str = Field(min_length=1, max_length=128)


class MarineUploadRecord(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timestamp: datetime
    sea_surface_temperature: float | None = None
    chlorophyll: float | None = None
    salinity: float | None = None
    dissolved_oxygen: float | None = None
    species_name: str | None = None
    fish_count: int | None = Field(default=None, ge=0)
    depth: float | None = None
    source: str = Field(default="manual_upload", min_length=1, max_length=120)
    raw: dict[str, Any] = Field(default_factory=dict)


class MarineUploadRequest(BaseModel):
    records: list[MarineUploadRecord] = Field(min_length=1, max_length=5000)


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    errors: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
