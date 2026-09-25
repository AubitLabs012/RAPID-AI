from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.ingestion.base import DataSourceClient, MarineDataRecord


class CopernicusMarineClient(DataSourceClient):
    source_name = "copernicus"

    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(
            endpoint=settings.copernicus_endpoint,
            api_key=settings.copernicus_api_key,
            timeout_seconds=settings.source_timeout_seconds,
        )

    def standardize(self, payload: Any) -> list[MarineDataRecord]:
        records = payload if isinstance(payload, list) else payload.get("records", [])
        return [
            MarineDataRecord(
                latitude=float(item.get("latitude", item.get("lat"))),
                longitude=float(item.get("longitude", item.get("lon"))),
                timestamp=item.get("timestamp") or datetime.now(timezone.utc),
                sea_surface_temperature=item.get("sst") or item.get("sea_surface_temperature"),
                chlorophyll=item.get("chlorophyll"),
                salinity=item.get("salinity"),
                dissolved_oxygen=item.get("dissolved_oxygen"),
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
                "lat": 12.85,
                "lon": 80.27,
                "timestamp": datetime.now(timezone.utc),
                "sst": 28.9,
                "chlorophyll": 1.8,
                "salinity": 34.2,
                "dissolved_oxygen": 6.4,
                "depth": 12,
            }
        ]
