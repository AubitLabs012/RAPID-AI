from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, func
from sqlmodel import Field, SQLModel


class TimestampMixin(SQLModel):
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
    )


class User(TimestampMixin, table=True):
    __tablename__ = "users"

    id: str = Field(primary_key=True)
    username: str
    username_lc: str = Field(sa_column=Column(String, unique=True, nullable=False, index=True))
    role: str = "user"
    display_name: str = ""
    password_hash: str = ""
    coins: int = 0
    stars: int = 0
    games_played: int = 0


class OceanCondition(TimestampMixin, table=True):
    __tablename__ = "ocean_conditions"

    id: int | None = Field(default=None, primary_key=True)
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    timestamp: datetime = Field(index=True)
    sea_surface_temperature: float | None = None
    chlorophyll: float | None = None
    salinity: float | None = None
    dissolved_oxygen: float | None = None
    depth: float | None = None
    source: str = Field(index=True)
    features: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class Species(TimestampMixin, table=True):
    __tablename__ = "species"

    id: int | None = Field(default=None, primary_key=True)
    scientific_name: str = Field(index=True, unique=True)
    common_name: str | None = None
    taxon_group: str | None = None
    conservation_status: str | None = None


class FishPopulation(TimestampMixin, table=True):
    __tablename__ = "fish_population"

    id: int | None = Field(default=None, primary_key=True)
    species_id: int | None = Field(default=None, sa_column=Column(ForeignKey("species.id"), nullable=True))
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    timestamp: datetime = Field(index=True)
    fish_count: int | None = None
    depth: float | None = None
    source: str = Field(index=True)


class MarineProtectedArea(TimestampMixin, table=True):
    __tablename__ = "marine_protected_areas"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    designation: str | None = None
    country: str | None = None
    centroid_latitude: float | None = Field(default=None, index=True)
    centroid_longitude: float | None = Field(default=None, index=True)
    geometry_geojson: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class SatelliteObservation(TimestampMixin, table=True):
    __tablename__ = "satellite_observations"

    id: int | None = Field(default=None, primary_key=True)
    ocean_condition_id: int | None = Field(
        default=None,
        sa_column=Column(ForeignKey("ocean_conditions.id"), nullable=True),
    )
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    timestamp: datetime = Field(index=True)
    platform: str | None = None
    product: str | None = None
    source: str = Field(index=True)
    observation: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class Prediction(TimestampMixin, table=True):
    __tablename__ = "predictions"

    id: int | None = Field(default=None, primary_key=True)
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    timestamp: datetime = Field(index=True)
    prediction_type: str = Field(index=True)
    value: float
    confidence: float
    source_observation_id: int | None = Field(
        default=None,
        sa_column=Column(ForeignKey("ocean_conditions.id"), nullable=True),
    )
    model_version: str
    model_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSON, nullable=False))


class Alert(TimestampMixin, table=True):
    __tablename__ = "alerts"

    id: int | None = Field(default=None, primary_key=True)
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    timestamp: datetime = Field(index=True)
    severity: str = Field(index=True)
    alert_type: str = Field(index=True)
    message: str
    active: bool = Field(default=True, index=True)
    prediction_id: int | None = Field(default=None, sa_column=Column(ForeignKey("predictions.id"), nullable=True))
    alert_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSON, nullable=False))
