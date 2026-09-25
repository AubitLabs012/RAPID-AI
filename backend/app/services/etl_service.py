from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.api.schemas import MarineUploadRecord
from app.ai.pipeline import MarineAIPipeline
from app.ingestion.base import DataSourceClient, MarineDataRecord
from app.ingestion.fetch_copernicus import CopernicusMarineClient
from app.ingestion.fetch_fisheries import FisheriesClient
from app.ingestion.fetch_incois import INCOISClient
from app.ingestion.fetch_noaa import NOAAClient
from app.ingestion.fetch_obis import OBISClient
from app.repositories.marine_repository import MarineRepository
from app.transformations.normalize import MarineTransformer


logger = logging.getLogger(__name__)


class MarineETLService:
    def __init__(self, clients: list[DataSourceClient] | None = None) -> None:
        self.clients = clients or [
            CopernicusMarineClient(),
            NOAAClient(),
            INCOISClient(),
            OBISClient(),
            FisheriesClient(),
        ]
        self.transformer = MarineTransformer()
        self.repository = MarineRepository()
        self.ai_pipeline = MarineAIPipeline()

    async def refresh(self) -> dict[str, Any]:
        started_at = datetime.now(timezone.utc)
        fetch_results = await asyncio.gather(
            *[self._fetch_source(client) for client in self.clients],
            return_exceptions=False,
        )

        records: list[MarineDataRecord] = []
        source_status: dict[str, dict[str, Any]] = {}
        for source_name, source_records, error_message in fetch_results:
            source_status[source_name] = {
                "records": len(source_records),
                "status": "failed" if error_message else "ok",
                "error": error_message,
            }
            records.extend(source_records)

        normalized = self.transformer.normalize(records)
        valid_observations = self.transformer.validate(normalized)
        stored = await self.repository.save_observations(valid_observations)
        ai_result = await self.ai_pipeline.run(valid_observations)

        finished_at = datetime.now(timezone.utc)
        return {
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "sources": source_status,
            "fetched_records": len(records),
            "valid_observations": len(valid_observations),
            "stored": stored,
            "ai": ai_result,
        }

    async def ingest_records(self, records: list[MarineUploadRecord]) -> dict[str, Any]:
        started_at = datetime.now(timezone.utc)
        marine_records = [MarineDataRecord(**record.model_dump()) for record in records]

        normalized = self.transformer.normalize(marine_records)
        valid_observations = self.transformer.validate(normalized)
        stored = await self.repository.save_observations(valid_observations)
        ai_result = await self.ai_pipeline.run(valid_observations)

        finished_at = datetime.now(timezone.utc)
        return {
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "uploaded_records": len(records),
            "valid_observations": len(valid_observations),
            "stored": stored,
            "ai": ai_result,
        }

    async def _fetch_source(self, client: DataSourceClient) -> tuple[str, list[MarineDataRecord], str | None]:
        try:
            records = await client.fetch_latest()
            return client.source_name, records, None
        except Exception as exc:
            logger.exception("%s ingestion failed", client.source_name)
            return client.source_name, [], str(exc)
