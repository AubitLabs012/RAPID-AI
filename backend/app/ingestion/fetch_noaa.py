from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.ingestion.base import DataSourceClient, MarineDataRecord


class NOAAClient(DataSourceClient):
    source_name = "noaa"

    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(
            endpoint=settings.noaa_endpoint,
            api_key=settings.noaa_api_key,
            timeout_seconds=settings.source_timeout_seconds,
        )

    def standardize(self, payload: Any) -> list[MarineDataRecord]:
        records = payload if isinstance(payload, list) else payload.get("results", payload.get("records", []))
        return [
            MarineDataRecord(
                latitude=float(item.get("latitude", item.get("lat"))),
                longitude=float(item.get("longitude", item.get("lon"))),
                timestamp=item.get("timestamp") or item.get("time") or datetime.now(timezone.utc),
                sea_surface_temperature=item.get("sea_surface_temperature") or item.get("sst"),
                chlorophyll=item.get("chlorophyll"),
                salinity=item.get("salinity"),
                dissolved_oxygen=item.get("dissolved_oxygen") or item.get("oxygen"),
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
                "lat": 16.42,
                "lon": 64.18,
                "time": datetime.now(timezone.utc),
                "sst": 27.4,
                "chlorophyll": 3.1,
                "salinity": 35.1,
                "oxygen": 6.1,
                "depth": 40,
            }
        ]
