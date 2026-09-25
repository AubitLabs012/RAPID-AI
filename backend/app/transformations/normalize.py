from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.ingestion.base import MarineDataRecord


class MarineObservation(BaseModel):
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
    source: str
    features: dict[str, Any] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)

    @field_validator("timestamp", mode="before")
    @classmethod
    def ensure_timestamp(cls, value):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.now(timezone.utc)


class MarineTransformer:
    def clean(self, records: list[MarineDataRecord]) -> list[MarineDataRecord]:
        deduped: dict[tuple, MarineDataRecord] = {}
        for record in records:
            key = (
                round(record.latitude, 5),
                round(record.longitude, 5),
                record.timestamp.isoformat(),
                record.source,
                record.species_name or "",
            )
            deduped[key] = record
        return list(deduped.values())

    def normalize(self, records: list[MarineDataRecord]) -> list[MarineObservation]:
        observations = [
            MarineObservation(
                latitude=record.latitude,
                longitude=record.longitude,
                timestamp=record.timestamp,
                sea_surface_temperature=self._bounded(record.sea_surface_temperature, -5, 45),
                chlorophyll=self._bounded(record.chlorophyll, 0, 100),
                salinity=self._bounded(record.salinity, 0, 50),
                dissolved_oxygen=self._bounded(record.dissolved_oxygen, 0, 20),
                species_name=record.species_name,
                fish_count=record.fish_count,
                depth=record.depth,
                source=record.source,
                raw=record.raw,
            )
            for record in self.clean(records)
        ]
        return self.generate_features(observations)

    def validate(self, observations: list[MarineObservation]) -> list[MarineObservation]:
        return [
            observation
            for observation in observations
            if any(
                value is not None
                for value in (
                    observation.sea_surface_temperature,
                    observation.chlorophyll,
                    observation.salinity,
                    observation.dissolved_oxygen,
                    observation.species_name,
                    observation.fish_count,
                )
            )
        ]

    def generate_features(self, observations: list[MarineObservation]) -> list[MarineObservation]:
        if not observations:
            return []

        try:
            import pandas as pd
            import xarray as xr
        except ImportError:
            return [self._with_basic_features(observation) for observation in observations]

        frame = pd.DataFrame([observation.model_dump() for observation in observations])
        frame["sst_anomaly"] = frame["sea_surface_temperature"] - frame["sea_surface_temperature"].mean()
        frame["chlorophyll_signal"] = frame["chlorophyll"].fillna(0).clip(lower=0)
        frame["oxygen_stress"] = (6 - frame["dissolved_oxygen"].fillna(6)).clip(lower=0)

        grid = xr.Dataset(
            data_vars={
                "sst": (("observation",), frame["sea_surface_temperature"].fillna(frame["sea_surface_temperature"].mean()).to_numpy()),
                "chlorophyll": (("observation",), frame["chlorophyll_signal"].to_numpy()),
                "oxygen_stress": (("observation",), frame["oxygen_stress"].to_numpy()),
            },
            coords={"observation": list(range(len(frame)))},
        )
        frame["ocean_energy_index"] = (
            grid["sst"].fillna(0) * 0.35 + grid["chlorophyll"].fillna(0) * 0.45 - grid["oxygen_stress"].fillna(0) * 0.2
        ).to_numpy()

        enriched: list[MarineObservation] = []
        for index, observation in enumerate(observations):
            features = {
                "sst_anomaly": self._finite_float(frame.iloc[index]["sst_anomaly"]),
                "chlorophyll_signal": self._finite_float(frame.iloc[index]["chlorophyll_signal"]),
                "oxygen_stress": self._finite_float(frame.iloc[index]["oxygen_stress"]),
                "ocean_energy_index": self._finite_float(frame.iloc[index]["ocean_energy_index"]),
            }
            enriched.append(observation.model_copy(update={"features": features}))
        return enriched

    def _with_basic_features(self, observation: MarineObservation) -> MarineObservation:
        oxygen = observation.dissolved_oxygen if observation.dissolved_oxygen is not None else 6
        features = {
            "sst_anomaly": 0.0,
            "chlorophyll_signal": observation.chlorophyll or 0.0,
            "oxygen_stress": max(0.0, 6 - oxygen),
            "ocean_energy_index": ((observation.sea_surface_temperature or 0.0) * 0.35)
            + ((observation.chlorophyll or 0.0) * 0.45)
            - (max(0.0, 6 - oxygen) * 0.2),
        }
        return observation.model_copy(update={"features": features})

    def _bounded(self, value: float | None, minimum: float, maximum: float) -> float | None:
        if value is None:
            return None
        return max(minimum, min(float(value), maximum))

    def _finite_float(self, value) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return 0.0
        if numeric != numeric:
            return 0.0
        return numeric
