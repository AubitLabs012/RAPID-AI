import json
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.api.schemas import ApiResponse, MarineUploadRecord, MarineUploadRequest
from app.services.etl_service import MarineETLService
from app.services.image_record_parser import ImageRecordParser
from app.services.marine_analytics import MarineAnalyticsService
from app.services.pdf_record_parser import PdfRecordParser


router = APIRouter(prefix="/marine", tags=["marine"])


class MarineMarkerResponse(BaseModel):
    id: str
    name: str
    region: str
    layer: str
    type: str
    lat: float
    lng: float
    summary: str
    metrics: dict[str, str] = Field(default_factory=dict)


MARKERS = [
    {
        "id": "sst-chennai-001",
        "name": "Chennai SST Anomaly",
        "region": "Bay of Bengal",
        "layer": "SST",
        "type": "sst",
        "lat": 12.85,
        "lng": 80.27,
        "summary": "Elevated nearshore surface temperature detected along the Chennai monitoring corridor.",
        "metrics": {"Temperature": "28.9 C", "Anomaly": "+0.7 C", "Confidence": "91%"},
    },
    {
        "id": "chl-arabian-001",
        "name": "Arabian Sea Chlorophyll Bloom",
        "region": "Arabian Sea",
        "layer": "Chlorophyll",
        "type": "chlorophyll",
        "lat": 16.42,
        "lng": 64.18,
        "summary": "Satellite-derived chlorophyll concentration indicates a productive bloom front.",
        "metrics": {"Chlorophyll": "3.1 mg/m3", "Trend": "+12%", "Confidence": "88%"},
    },
    {
        "id": "fish-bengal-001",
        "name": "Pelagic Fish Aggregation",
        "region": "Northern Bay of Bengal",
        "layer": "Fisheries",
        "type": "fisheries",
        "lat": 18.67,
        "lng": 88.72,
        "summary": "Model predicts a high-probability pelagic aggregation zone over the next 72 hours.",
        "metrics": {"Abundance": "74/100", "Forecast": "Rising", "Confidence": "86%"},
    },
    {
        "id": "bio-andaman-001",
        "name": "Andaman Biodiversity Hotspot",
        "region": "Andaman Sea",
        "layer": "Biodiversity",
        "type": "biodiversity",
        "lat": 11.74,
        "lng": 92.65,
        "summary": "Species richness is above seasonal baseline near island reef and mangrove systems.",
        "metrics": {"Index": "81/100", "Species": "346", "Confidence": "90%"},
    },
    {
        "id": "coral-gbr-001",
        "name": "Great Barrier Reef Watch",
        "region": "Coral Sea",
        "layer": "Coral reefs",
        "type": "coral",
        "lat": -18.28,
        "lng": 147.7,
        "summary": "Reef watch station reports thermal stress risk across shallow reef flats.",
        "metrics": {"Bleaching Risk": "High", "Degree Heating": "6.2", "Confidence": "93%"},
    },
    {
        "id": "current-somali-001",
        "name": "Somali Current Velocity",
        "region": "Western Indian Ocean",
        "layer": "Ocean currents",
        "type": "currents",
        "lat": 4.8,
        "lng": 53.9,
        "summary": "Surface current vectors show strong northeast transport in the monsoon corridor.",
        "metrics": {"Velocity": "1.2 m/s", "Direction": "NE", "Confidence": "84%"},
    },
]

MARKERS_FILE = Path(__file__).resolve().parents[4] / "src" / "marine-markers.json"


def _current_markers() -> list[dict]:
    try:
        with MARKERS_FILE.open("r", encoding="utf-8") as marker_file:
            loaded = json.load(marker_file)
        if isinstance(loaded, list):
            return loaded
    except (OSError, json.JSONDecodeError):
        pass
    return MARKERS


def _record_layer(record: MarineUploadRecord) -> tuple[str, str]:
    if record.fish_count is not None:
        return "fisheries", "Fisheries"
    if record.species_name:
        return "biodiversity", "Biodiversity"
    if record.chlorophyll is not None:
        return "chlorophyll", "Chlorophyll"
    if record.sea_surface_temperature is not None:
        return "sst", "SST"
    if record.dissolved_oxygen is not None or record.salinity is not None:
        return "health", "Ocean Health"
    return "currents", "Marine record"


def _record_metrics(record: MarineUploadRecord) -> dict[str, str]:
    metrics: dict[str, str] = {}
    if record.sea_surface_temperature is not None:
        metrics["SST"] = f"{record.sea_surface_temperature:.2f} C"
    if record.chlorophyll is not None:
        metrics["Chlorophyll"] = f"{record.chlorophyll:.2f} mg/m3"
    if record.salinity is not None:
        metrics["Salinity"] = f"{record.salinity:.2f} PSU"
    if record.dissolved_oxygen is not None:
        metrics["Dissolved Oxygen"] = f"{record.dissolved_oxygen:.2f} mg/L"
    if record.fish_count is not None:
        metrics["Fish Count"] = str(record.fish_count)
    if record.depth is not None:
        metrics["Depth"] = f"{record.depth:.1f} m"
    if record.species_name:
        metrics["Species"] = record.species_name
    return metrics


def _build_upload_markers(records: list[MarineUploadRecord], filename: str | None = None) -> list[dict]:
    markers: list[dict] = []
    for index, record in enumerate(records, start=1):
        marker_type, layer = _record_layer(record)
        metrics = _record_metrics(record)
        station = record.raw.get("station") or record.raw.get("name") or record.raw.get("location")
        name = station or record.species_name or f"Uploaded marine station {index}"
        summary_parts = [f"Uploaded record at {record.latitude:.3f}, {record.longitude:.3f}"]
        if record.species_name:
            summary_parts.append(f"species: {record.species_name}")
        if metrics:
            summary_parts.append(", ".join(f"{key}: {value}" for key, value in list(metrics.items())[:3]))

        markers.append(
            {
                "id": f"upload-{index}-{abs(hash((record.latitude, record.longitude, record.timestamp.isoformat()))) % 100000}",
                "name": str(name),
                "region": record.source or filename or "Uploaded dataset",
                "layer": layer,
                "type": marker_type,
                "lat": record.latitude,
                "lng": record.longitude,
                "summary": ". ".join(summary_parts),
                "metrics": metrics,
            }
        )
    return markers


def _build_upload_analysis(records: list[MarineUploadRecord]) -> str:
    if not records:
        return "No valid locations were found in the uploaded dataset."

    metric_counts = {
        "temperature": sum(record.sea_surface_temperature is not None for record in records),
        "chlorophyll": sum(record.chlorophyll is not None for record in records),
        "fish": sum(record.fish_count is not None for record in records),
        "biodiversity": sum(record.species_name is not None for record in records),
        "water quality": sum(record.salinity is not None or record.dissolved_oxygen is not None for record in records),
    }
    dominant = max(metric_counts, key=metric_counts.get)
    latitudes = [record.latitude for record in records]
    longitudes = [record.longitude for record in records]
    return (
        f"Loaded {len(records)} uploaded sea location{'s' if len(records) != 1 else ''}. "
        f"Primary signal: {dominant}. "
        f"Map is now filtered to uploaded coordinates only "
        f"({min(latitudes):.2f} to {max(latitudes):.2f} lat, {min(longitudes):.2f} to {max(longitudes):.2f} lon)."
    )


def _attach_upload_outputs(result: dict, records: list[MarineUploadRecord], filename: str | None) -> dict:
    result["parsed_records"] = len(records)
    result["markers"] = _build_upload_markers(records, filename)
    result["analysis"] = _build_upload_analysis(records)
    return result


@router.get("/markers", response_model=list[MarineMarkerResponse])
def list_markers() -> list[dict]:
    return _current_markers()


@router.get("/analytics")
def marker_analytics() -> dict:
    try:
        return MarineAnalyticsService().build_marker_analytics(_current_markers())
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/upload", response_model=ApiResponse)
async def upload_marine_records(payload: MarineUploadRequest) -> ApiResponse:
    result = await MarineETLService().ingest_records(payload.records)
    result = _attach_upload_outputs(result, payload.records, "manual upload")
    return ApiResponse(message="Marine upload processed", data=result)


@router.post("/upload-pdf", response_model=ApiResponse)
async def upload_marine_pdf(file: UploadFile = File(...)) -> ApiResponse:
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a PDF file")

    payload = await file.read()
    try:
        records = PdfRecordParser().extract_records(payload, file.filename or "records.pdf")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not records:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No marine records found. Include columns for latitude, longitude, timestamp, and at least one metric.",
        )

    result = await MarineETLService().ingest_records(records)
    result["parsed_records"] = len(records)
    result["filename"] = file.filename
    result = _attach_upload_outputs(result, records, file.filename)
    return ApiResponse(message="Marine PDF upload processed", data=result)


@router.post("/upload-image", response_model=ApiResponse)
async def upload_marine_image(file: UploadFile = File(...)) -> ApiResponse:
    if file.content_type not in {"image/png", "image/jpeg", "image/jpg", "image/webp", "application/octet-stream"}:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a PNG, JPG, or WEBP image")

    payload = await file.read()
    try:
        records = ImageRecordParser().extract_records(payload, file.filename or "records-image")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if not records:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No marine records found. Upload a clear image with latitude, longitude, timestamp, and at least one metric.",
        )

    result = await MarineETLService().ingest_records(records)
    result["parsed_records"] = len(records)
    result["filename"] = file.filename
    result = _attach_upload_outputs(result, records, file.filename)
    return ApiResponse(message="Marine image upload processed", data=result)
