"""Public NASA observation metadata. GIBS and EONET do not require API keys.

Imagery times come from WMTS capabilities, not the server clock. The clock only
prevents dates in the future from being offered as observations.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
import math
import time
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

import httpx
from fastapi import APIRouter, HTTPException


router = APIRouter(prefix="/live", tags=["live-imagery"])
CAPABILITIES_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml"
FIRE_STYLE_URL = "https://gibs.earthdata.nasa.gov/vector-styles/v1.0/FIRMS_VIIRS_Thermal_Anomalies.json"
EVENTS_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
ATTRIBUTION = "NASA GIBS / EOSDIS"
NS = {"wmts": "http://www.opengis.net/wmts/1.0", "ows": "http://www.opengis.net/ows/1.1"}
SUPPORTED = {
    "MODIS_Terra_CorrectedReflectance_TrueColor": "base",
    "VIIRS_SNPP_CorrectedReflectance_TrueColor": "base",
    "VIIRS_SNPP_Thermal_Anomalies_375m_All": "overlay",
}
CACHE_SECONDS = 600
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_retry_after: dict[str, float] = {}
_locks: dict[str, asyncio.Lock] = {}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(element: ET.Element, path: str) -> str:
    return (element.findtext(path, namespaces=NS) or "").strip()


def _intervals(dimension: ET.Element, today: date) -> list[dict[str, str]]:
    """Keep advertised daily intervals, including gaps and single-day entries."""
    intervals = []
    for item in dimension.findall("wmts:Value", NS):
        parts = (item.text or "").strip().split("/")
        if len(parts) not in (1, 3) or (len(parts) == 3 and parts[2] != "P1D"):
            continue
        try:
            start = date.fromisoformat(parts[0])
            end = min(date.fromisoformat(parts[1]) if len(parts) == 3 else start, today)
        except ValueError:
            continue
        if start <= end:
            intervals.append({"start": start.isoformat(), "end": end.isoformat(), "period": "P1D"})
    return sorted(intervals, key=lambda item: item["start"])


def parse_capabilities(xml: bytes, fire_style: dict[str, Any], today: date | None = None) -> list[dict[str, Any]]:
    root = ET.fromstring(xml)
    contents = root.find("wmts:Contents", NS)
    if contents is None:
        raise ValueError("GIBS capabilities have no contents")
    today = today or datetime.now(timezone.utc).date()
    matrices = {}
    for item in contents.findall("wmts:TileMatrixSet", NS):
        levels = item.findall("wmts:TileMatrix", NS)
        if levels:
            matrices[_text(item, "ows:Identifier")] = {
                "maxzoom": max(int(_text(level, "ows:Identifier")) for level in levels),
                "tile_size": int(_text(levels[0], "wmts:TileWidth")),
            }
    layers = []
    for item in contents.findall("wmts:Layer", NS):
        identifier = _text(item, "ows:Identifier")
        if identifier not in SUPPORTED:
            continue
        dimension = next((d for d in item.findall("wmts:Dimension", NS) if _text(d, "ows:Identifier").lower() == "time"), None)
        if dimension is None:
            continue
        intervals = _intervals(dimension, today)
        matrix = _text(item, "wmts:TileMatrixSetLink/wmts:TileMatrixSet")
        if not intervals or matrix not in matrices:
            continue
        resource = next((r for r in item.findall("wmts:ResourceURL", NS) if r.get("resourceType") == "tile" and "{Time}" in r.get("template", "")), None)
        if resource is None:
            continue
        template = resource.get("template", "")
        # Only send browsers to this fixed, public NASA tile service.
        parsed_url = urlparse(template)
        if parsed_url.scheme != "https" or parsed_url.netloc != "gibs.earthdata.nasa.gov":
            continue
        mime = resource.get("format", "")
        vector = mime == "application/vnd.mapbox-vector-tile"
        source_layers = sorted({layer["source-layer"] for layer in fire_style.get("layers", []) if layer.get("source") == identifier and isinstance(layer.get("source-layer"), str)}) if vector else []
        if vector and not source_layers:
            continue
        if not vector and mime not in {"image/jpeg", "image/png"}:
            continue
        for key, value in {"Time": "{date}", "TileMatrixSet": matrix, "TileMatrix": "{z}", "TileRow": "{y}", "TileCol": "{x}"}.items():
            template = template.replace("{" + key + "}", value)
        # EPSG:3857 vector WMTS is advertised but currently returns 404.
        # GIBS WMS renders the same observed VIIRS detections into Mercator PNGs.
        # MapLibre expands its documented bbox-epsg-3857 tile placeholder.
        if vector:
            template = (
                "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
                "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap"
                f"&LAYERS={identifier}&STYLES=&SRS=EPSG:3857"
                "&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256"
                "&FORMAT=image/png&TRANSPARENT=TRUE&TIME={date}"
            )
            mime = "image/png"
            vector = False
            source_layers = []
        latest = max(interval["end"] for interval in intervals)
        advertised_default = _text(dimension, "wmts:Default")
        default = advertised_default if any(i["start"] <= advertised_default <= i["end"] for i in intervals) else latest
        layers.append({
            "id": identifier, "title": _text(item, "ows:Title"), "kind": SUPPORTED[identifier],
            "source_type": "vector" if vector else "raster", "source_layers": source_layers,
            "date_min": intervals[0]["start"], "date_max": latest, "default_date": default,
            "date_intervals": intervals, "tiles": template, "format": mime,
            "tile_matrix_set": matrix, **matrices[matrix], "attribution": ATTRIBUTION,
        })
    if not any(layer["kind"] == "base" for layer in layers):
        raise ValueError("No supported NASA imagery layers were advertised")
    return sorted(layers, key=lambda layer: list(SUPPORTED).index(layer["id"]))


async def _imagery() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(30, connect=8), follow_redirects=False) as client:
        capabilities, style = await asyncio.gather(client.get(CAPABILITIES_URL), client.get(FIRE_STYLE_URL), return_exceptions=True)
    if isinstance(capabilities, Exception):
        raise capabilities
    capabilities.raise_for_status()
    style_data = {}
    if isinstance(style, httpx.Response) and style.status_code == 200:
        try:
            style_data = style.json()
        except ValueError:
            pass
    layers = parse_capabilities(capabilities.content, style_data)
    return {
        "provider": "NASA GIBS", "fetched_at": _utc_now(), "attribution": ATTRIBUTION,
        "capabilities_url": CAPABILITIES_URL, "layers": layers,
        "unavailable_layers": [identifier for identifier in SUPPORTED if identifier not in {layer["id"] for layer in layers}],
        "notice": "Daily satellite observations, not a real-time video. Dates reflect NASA's advertised availability; coverage can be incomplete while a day is still being processed.",
    }


def parse_events(payload: dict[str, Any]) -> list[dict[str, Any]]:
    events = []
    for event in payload.get("events", []):
        points = [g for g in event.get("geometry", []) if g.get("type") == "Point" and isinstance(g.get("coordinates"), list) and len(g["coordinates"]) >= 2]
        if not points:
            continue
        latest = max(points, key=lambda point: point.get("date", ""))
        longitude, latitude = latest["coordinates"][:2]
        if not all(isinstance(value, (float, int)) and math.isfinite(value) for value in (longitude, latitude)) or not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            continue
        categories = event.get("categories") or [{}]
        sources = event.get("sources") or [{}]
        events.append({
            "id": event["id"], "title": event["title"],
            "category": categories[0].get("title", "Natural event"), "category_id": categories[0].get("id", "unknown"),
            "longitude": longitude, "latitude": latitude, "observed_at": latest.get("date"),
            "magnitude_value": latest.get("magnitudeValue"), "magnitude_unit": latest.get("magnitudeUnit"),
            "source_url": sources[0].get("url"), "url": event.get("link"),
        })
    return events


async def _events() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=8)) as client:
        response = await client.get(EVENTS_URL, params={"status": "open", "days": 30, "limit": 100})
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload.get("events"), list):
        raise ValueError("EONET response has no events list")
    return {
        "provider": "NASA EONET", "fetched_at": _utc_now(), "events": parse_events(payload),
        "notice": "Open events reported during the past 30 days. Each marker is the latest reported point; this catalog is not exhaustive and is not an emergency alert service.",
    }


async def _cached(key: str, loader: Callable[[], Awaitable[dict[str, Any]]]) -> dict[str, Any]:
    async with _locks.setdefault(key, asyncio.Lock()):
        now = time.monotonic()
        entry = _cache.get(key)
        if entry and now - entry[0] < CACHE_SECONDS:
            return {**entry[1], "status": "available", "stale": False}
        if now >= _retry_after.get(key, 0):
            try:
                payload = await loader()
                _cache[key] = (time.monotonic(), payload)
                _retry_after.pop(key, None)
                return {**payload, "status": "available", "stale": False}
            except (httpx.HTTPError, ValueError, TypeError, KeyError, ET.ParseError):
                _retry_after[key] = time.monotonic() + 45
        if entry and now - entry[0] < 86400:
            return {**entry[1], "status": "stale", "stale": True, "warning": "NASA is currently unavailable. Showing cached metadata from fetched_at."}
        raise HTTPException(status_code=503, detail="NASA observations are temporarily unavailable. Please retry shortly.")


@router.get("/imagery")
async def imagery_catalog() -> dict[str, Any]:
    return await _cached("imagery", _imagery)


@router.get("/events")
async def observed_events() -> dict[str, Any]:
    return await _cached("events", _events)
