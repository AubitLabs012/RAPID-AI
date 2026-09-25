from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any
from urllib import error, parse, request

from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)


class MarineDataRecord(BaseModel):
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
    raw: dict[str, Any] = Field(default_factory=dict)


class DataSourceClient:
    source_name = "unknown"

    def __init__(self, endpoint: str = "", api_key: str = "", timeout_seconds: int = 30) -> None:
        self.endpoint = endpoint
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    async def fetch_latest(self) -> list[MarineDataRecord]:
        payload = await self._request_latest_payload()
        return self.standardize(payload)

    async def _request_latest_payload(self) -> Any:
        if not self.endpoint:
            logger.info("%s endpoint is not configured; using local sample payload", self.source_name)
            return self.sample_payload()

        return await asyncio.to_thread(self._get_json_with_retries, self.endpoint)

    def _get_json_with_retries(self, url: str, attempts: int = 3) -> Any:
        headers = {"Accept": "application/json", "User-Agent": "RAPID-AI-ETL/1.0"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                req = request.Request(url, headers=headers, method="GET")
                with request.urlopen(req, timeout=self.timeout_seconds) as response:
                    return json.loads(response.read().decode("utf-8"))
            except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_error = exc
                logger.warning("%s fetch attempt %s/%s failed: %s", self.source_name, attempt, attempts, exc)
                time.sleep(min(2**attempt, 8))

        raise RuntimeError(f"{self.source_name} fetch failed after {attempts} attempts") from last_error

    def build_url(self, params: dict[str, Any]) -> str:
        query = parse.urlencode({key: value for key, value in params.items() if value is not None})
        separator = "&" if "?" in self.endpoint else "?"
        return f"{self.endpoint}{separator}{query}" if query else self.endpoint

    def standardize(self, payload: Any) -> list[MarineDataRecord]:
        raise NotImplementedError

    def sample_payload(self) -> Any:
        return []
