from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from app.cache.redis_cache import CacheService
from app.config import get_settings
from app.repositories.marine_repository import MarineRepository


class MarineDashboardService:
    def __init__(self) -> None:
        self.repository = MarineRepository()
        self.cache = CacheService()
        self.settings = get_settings()

    async def list_ocean(self, limit: int = 250) -> list[dict[str, Any]]:
        return await self.repository.list_ocean_conditions(limit=limit)

    async def list_species(self, limit: int = 250) -> list[dict[str, Any]]:
        return await self.repository.list_species(limit=limit)

    async def list_predictions(self, limit: int = 250) -> list[dict[str, Any]]:
        return await self.repository.list_predictions(limit=limit)

    async def list_alerts(self, limit: int = 250) -> list[dict[str, Any]]:
        return await self.repository.list_alerts(limit=limit)

    async def location_snapshot(self, latitude: float, longitude: float) -> dict[str, Any]:
        cache_key = f"location:{round(latitude, 3)}:{round(longitude, 3)}"
        cached = self.cache.get(cache_key)
        if isinstance(cached, str):
            return json.loads(cached)

        context = await self.repository.get_location_context(latitude, longitude)
        ocean = context.get("ocean") or {}
        predictions = context.get("predictions") or []
        alerts = context.get("alerts") or []
        fish_population = context.get("fish_population") or []

        prediction_map = {item["prediction_type"]: item for item in predictions}
        fish_abundance = self._prediction_value(prediction_map, "fish_abundance_prediction")
        biodiversity_index = self._prediction_value(prediction_map, "species_richness")
        ocean_health_score = self._prediction_value(prediction_map, "ocean_health_score")

        if fish_abundance is None:
            fish_abundance = float(sum(item.get("fish_count") or 0 for item in fish_population))

        snapshot = {
            "location": {"latitude": latitude, "longitude": longitude},
            "sea_surface_temperature": ocean.get("sea_surface_temperature"),
            "chlorophyll": ocean.get("chlorophyll"),
            "salinity": ocean.get("salinity"),
            "fish_abundance": fish_abundance,
            "biodiversity_index": biodiversity_index,
            "ocean_health_score": ocean_health_score,
            "active_alerts": alerts,
            "latest_observation": ocean,
            "summary": self._summary(ocean, fish_abundance, biodiversity_index, ocean_health_score, alerts),
        }
        self.cache.set(cache_key, json.dumps(snapshot, default=self._json_default), self.settings.dashboard_cache_ttl_seconds)
        return snapshot

    def _prediction_value(self, prediction_map: dict[str, dict[str, Any]], key: str) -> float | None:
        value = prediction_map.get(key, {}).get("value")
        return float(value) if value is not None else None

    def _summary(
        self,
        ocean: dict[str, Any],
        fish_abundance: float | None,
        biodiversity_index: float | None,
        ocean_health_score: float | None,
        alerts: list[dict[str, Any]],
    ) -> str:
        if not ocean:
            return "RAPID-AI has no recent observation near this location yet. Run a refresh to load disaster intelligence data."

        health_text = "unknown" if ocean_health_score is None else f"{round(ocean_health_score, 1)}/100"
        alert_text = "no active alerts" if not alerts else f"{len(alerts)} active alert(s)"
        fish_text = "unknown" if fish_abundance is None else str(round(fish_abundance, 1))
        biodiversity_text = "unknown" if biodiversity_index is None else str(round(biodiversity_index, 1))
        return (
            "RAPID-AI reports recent ocean conditions from "
            f"{ocean.get('source', 'available sources')}: SST {ocean.get('sea_surface_temperature')}, "
            f"chlorophyll {ocean.get('chlorophyll')}, salinity {ocean.get('salinity')}. "
            f"Fish abundance is {fish_text}, biodiversity index is {biodiversity_text}, "
            f"ocean health is {health_text}, with {alert_text}."
        )

    def _json_default(self, value):
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)
