from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.ingestion.base import DataSourceClient, MarineDataRecord


class FisheriesClient(DataSourceClient):
    source_name = "public_fisheries"

    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(
            endpoint=settings.fisheries_endpoint,
            api_key=settings.fisheries_api_key,
            timeout_seconds=settings.source_timeout_seconds,
        )

    def standardize(self, payload: Any) -> list[MarineDataRecord]:
        records = payload if isinstance(payload, list) else payload.get("records", [])
        return [
            MarineDataRecord(
                latitude=float(item.get("latitude", item.get("lat"))),
                longitude=float(item.get("longitude", item.get("lon"))),
                timestamp=item.get("timestamp") or item.get("observed_at") or datetime.now(timezone.utc),
                species_name=item.get("species_name"),
                fish_count=item.get("fish_count") or item.get("catch_count"),
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
                "lat": 4.8,
                "lon": 53.9,
                "observed_at": datetime.now(timezone.utc),
                "species_name": "Sardinella longiceps",
                "catch_count": 210,
                "depth": 35,
            }
        ]
