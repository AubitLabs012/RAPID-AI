from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.ingestion.base import DataSourceClient, MarineDataRecord


class INCOISClient(DataSourceClient):
    source_name = "incois"

    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(
            endpoint=settings.incois_endpoint,
            api_key=settings.incois_api_key,
            timeout_seconds=settings.source_timeout_seconds,
        )

    def standardize(self, payload: Any) -> list[MarineDataRecord]:
        records = payload if isinstance(payload, list) else payload.get("data", payload.get("records", []))
        return [
            MarineDataRecord(
                latitude=float(item.get("latitude", item.get("lat"))),
                longitude=float(item.get("longitude", item.get("lon"))),
                timestamp=item.get("timestamp") or datetime.now(timezone.utc),
                sea_surface_temperature=item.get("sst"),
                chlorophyll=item.get("chlorophyll"),
                salinity=item.get("salinity"),
                dissolved_oxygen=item.get("dissolved_oxygen"),
                fish_count=item.get("fish_count") or item.get("potential_fishing_zone_score"),
                depth=item.get("depth"),
                source=self.source_name,
                raw=item,
            )
            for item in records
            if item.get("latitude", item.get("lat")) is not None and item.get("longitude", item.get("lon")) is not None
        ]

    def sample_payload(self) -> Any:
        return [
            {
                "lat": 18.67,
                "lon": 88.72,
                "timestamp": datetime.now(timezone.utc),
                "sst": 28.1,
                "chlorophyll": 2.7,
                "salinity": 33.8,
                "dissolved_oxygen": 5.8,
                "potential_fishing_zone_score": 74,
                "depth": 55,
            }
        ]
