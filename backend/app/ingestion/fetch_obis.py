from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.ingestion.base import DataSourceClient, MarineDataRecord


class OBISClient(DataSourceClient):
    source_name = "obis"

    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(
            endpoint=settings.obis_endpoint,
            api_key=settings.obis_api_key,
            timeout_seconds=settings.source_timeout_seconds,
        )

    def standardize(self, payload: Any) -> list[MarineDataRecord]:
        records = payload if isinstance(payload, list) else payload.get("results", payload.get("records", []))
        return [
            MarineDataRecord(
                latitude=float(item.get("decimalLatitude", item.get("latitude", item.get("lat")))),
                longitude=float(item.get("decimalLongitude", item.get("longitude", item.get("lon")))),
                timestamp=item.get("eventDate") or item.get("timestamp") or datetime.now(timezone.utc),
                species_name=item.get("scientificName") or item.get("species_name"),
                fish_count=item.get("individualCount") or item.get("fish_count") or 1,
                depth=item.get("depth") or item.get("minimumDepthInMeters"),
                source=self.source_name,
                raw=item,
            )
            for item in records
            if item.get("decimalLatitude", item.get("latitude", item.get("lat"))) is not None
            and item.get("decimalLongitude", item.get("longitude", item.get("lon"))) is not None
        ]

    def sample_payload(self) -> Any:
        return [
            {
                "decimalLatitude": 11.74,
                "decimalLongitude": 92.65,
                "eventDate": datetime.now(timezone.utc),
                "scientificName": "Thunnus albacares",
                "individualCount": 32,
                "minimumDepthInMeters": 22,
            },
            {
                "decimalLatitude": -18.28,
                "decimalLongitude": 147.7,
                "eventDate": datetime.now(timezone.utc),
                "scientificName": "Acropora millepora",
                "individualCount": 120,
                "minimumDepthInMeters": 8,
            },
        ]
