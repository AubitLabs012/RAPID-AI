from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any

from app.api.schemas import MarineUploadRecord


FIELD_ALIASES = {
    "latitude": {"lat", "latitude", "y"},
    "longitude": {"lon", "lng", "long", "longitude", "x"},
    "timestamp": {"time", "date", "datetime", "timestamp", "observed_at"},
    "sea_surface_temperature": {"sst", "temperature", "sea_surface_temperature", "sea surface temperature"},
    "chlorophyll": {"chl", "chlorophyll", "chlorophyll_a", "chlorophyll-a"},
    "salinity": {"sal", "salinity"},
    "dissolved_oxygen": {"do", "oxygen", "dissolved_oxygen", "dissolved oxygen"},
    "species_name": {"species", "species_name", "scientific_name", "scientific name"},
    "fish_count": {"fish_count", "fish count", "count", "abundance"},
    "depth": {"depth", "depth_m", "depth m"},
    "source": {"source", "station", "dataset"},
}


class PdfRecordParser:
    def extract_records(self, payload: bytes, filename: str) -> list[MarineUploadRecord]:
        text = self._extract_text(payload)
        return self.extract_records_from_text(text, filename, source_prefix="pdf")

    def extract_records_from_text(self, text: str, filename: str, source_prefix: str) -> list[MarineUploadRecord]:
        rows = self._extract_table_rows(text)
        if not rows:
            rows = self._extract_key_value_rows(text)

        records: list[MarineUploadRecord] = []
        for row in rows:
            record = self._row_to_record(row, filename, source_prefix)
            if record is not None:
                records.append(record)
        return records

    def _extract_text(self, payload: bytes) -> str:
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise RuntimeError("Install pypdf to upload PDF records: python -m pip install pypdf") from exc

        try:
            reader = PdfReader(io.BytesIO(payload))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            raise RuntimeError("Unable to read PDF text. Use a text-based PDF, not a scanned image PDF.") from exc

    def _extract_table_rows(self, text: str) -> list[dict[str, str]]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        parsed_rows: list[dict[str, str]] = []

        for index, line in enumerate(lines):
            header_parts = self._split_line(line)
            mapped_headers = [self._map_header(part) for part in header_parts]
            if "latitude" not in mapped_headers or "longitude" not in mapped_headers:
                continue

            for data_line in lines[index + 1 :]:
                values = self._split_line(data_line)
                if len(values) < 3:
                    continue
                if len(values) > len(mapped_headers):
                    values = values[: len(mapped_headers) - 1] + [" ".join(values[len(mapped_headers) - 1 :])]

                row = {
                    header: values[position]
                    for position, header in enumerate(mapped_headers)
                    if header and position < len(values)
                }
                if "latitude" in row and "longitude" in row:
                    parsed_rows.append(row)

        return parsed_rows

    def _extract_key_value_rows(self, text: str) -> list[dict[str, str]]:
        chunks = re.split(r"\n\s*\n|Record\s*[:#]\s*", text, flags=re.IGNORECASE)
        rows: list[dict[str, str]] = []
        pattern = re.compile(r"([A-Za-z_ -]+)\s*[:=]\s*([^,\n;]+)")

        for chunk in chunks:
            row: dict[str, str] = {}
            for raw_key, value in pattern.findall(chunk):
                field = self._map_header(raw_key)
                if field:
                    row[field] = value.strip()
            if "latitude" in row and "longitude" in row:
                rows.append(row)
        return rows

    def _split_line(self, line: str) -> list[str]:
        if "|" in line:
            return [part.strip() for part in line.split("|") if part.strip()]
        if "\t" in line:
            return [part.strip() for part in line.split("\t") if part.strip()]
        if "," in line:
            return [part.strip() for part in next(csv.reader([line])) if part.strip()]
        return [part.strip() for part in re.split(r"\s{2,}", line) if part.strip()]

    def _map_header(self, value: str) -> str | None:
        normalized = re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
        compact = normalized.replace(" ", "_")
        for field, aliases in FIELD_ALIASES.items():
            if normalized in aliases or compact in aliases:
                return field
        return None

    def _row_to_record(self, row: dict[str, str], filename: str, source_prefix: str) -> MarineUploadRecord | None:
        try:
            latitude = self._float(row.get("latitude"))
            longitude = self._float(row.get("longitude"))
        except ValueError:
            return None

        if latitude is None or longitude is None:
            return None

        source = row.get("source") or f"{source_prefix}:{filename}"
        raw: dict[str, Any] = {key: value for key, value in row.items() if value not in ("", None)}
        return MarineUploadRecord(
            latitude=latitude,
            longitude=longitude,
            timestamp=self._timestamp(row.get("timestamp")),
            sea_surface_temperature=self._float(row.get("sea_surface_temperature")),
            chlorophyll=self._float(row.get("chlorophyll")),
            salinity=self._float(row.get("salinity")),
            dissolved_oxygen=self._float(row.get("dissolved_oxygen")),
            species_name=self._text(row.get("species_name")),
            fish_count=self._int(row.get("fish_count")),
            depth=self._float(row.get("depth")),
            source=source,
            raw=raw,
        )

    def _timestamp(self, value: str | None) -> datetime:
        if not value:
            return datetime.now(timezone.utc)
        try:
            return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return datetime.now(timezone.utc)

    def _float(self, value: str | None) -> float | None:
        if value is None or value == "":
            return None
        match = re.search(r"-?\d+(?:\.\d+)?", str(value))
        if not match:
            raise ValueError("Missing numeric value")
        return float(match.group(0))

    def _int(self, value: str | None) -> int | None:
        numeric = self._float(value)
        return int(numeric) if numeric is not None else None

    def _text(self, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None
