from functools import lru_cache
import os
from pathlib import Path


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


class Settings:
    app_name = "RAPID-AI Backend"
    api_prefix = "/api"
    environment = os.getenv("ENVIRONMENT", "development")
    debug = os.getenv("DEBUG", "true").lower() == "true"

    jwt_secret = os.getenv("JWT_SECRET", "change-me-in-production")
    jwt_issuer = os.getenv("JWT_ISSUER", "aubit-backend")
    jwt_audience = os.getenv("JWT_AUDIENCE", "aubit-clients")
    jwt_expiry_minutes = int(os.getenv("JWT_EXPIRY_MINUTES", "60"))

    allowed_origins = [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:4175,http://127.0.0.1:4175").split(",")
        if origin.strip()
    ]

    database_url = os.getenv("DATABASE_URL", "")
    redis_url = os.getenv("REDIS_URL", "")

    firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "")
    firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "")

    ai_provider = os.getenv("AI_PROVIDER", "gemini")
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    groq_api_key = os.getenv("GROQ_API_KEY", "")
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    groq_vision_model = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b")
    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY", "")
    stripe_api_key = os.getenv("STRIPE_API_KEY", "")
    gcp_storage_bucket = os.getenv("GCP_STORAGE_BUCKET", "")
    gcp_credentials_path = os.getenv("GCP_CREDENTIALS_PATH", "")
    sentry_dsn = os.getenv("SENTRY_DSN", "")
    earthdata_token = os.getenv("EARTHDATA_TOKEN", "")
    nasa_firms_key = os.getenv("NASA_FIRMS_KEY", "")
    nasa_api_key = os.getenv("NASA_API_KEY", "")
    windy_maps_api_key = os.getenv("WINDY_MAPS_API_KEY", "")
    s3_bucket = os.getenv("S3_BUCKET", "")
    s3_endpoint_url = os.getenv("S3_ENDPOINT_URL", "")
    s3_access_key = os.getenv("S3_ACCESS_KEY", "")
    s3_secret_key = os.getenv("S3_SECRET_KEY", "")

    rate_limit_requests = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
    rate_limit_window_seconds = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

    source_timeout_seconds = int(os.getenv("SOURCE_TIMEOUT_SECONDS", "30"))
    etl_batch_size = int(os.getenv("ETL_BATCH_SIZE", "500"))
    scheduler_enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    scheduler_interval_hours = int(os.getenv("SCHEDULER_INTERVAL_HOURS", "24"))
    dashboard_cache_ttl_seconds = int(os.getenv("DASHBOARD_CACHE_TTL_SECONDS", "300"))

    copernicus_endpoint = os.getenv("COPERNICUS_ENDPOINT", "")
    copernicus_api_key = os.getenv("COPERNICUS_API_KEY", "")
    noaa_endpoint = os.getenv("NOAA_ENDPOINT", "")
    noaa_api_key = os.getenv("NOAA_API_KEY", "")
    incois_endpoint = os.getenv("INCOIS_ENDPOINT", "")
    incois_api_key = os.getenv("INCOIS_API_KEY", "")
    obis_endpoint = os.getenv("OBIS_ENDPOINT", "")
    obis_api_key = os.getenv("OBIS_API_KEY", "")
    fisheries_endpoint = os.getenv("FISHERIES_ENDPOINT", "")
    fisheries_api_key = os.getenv("FISHERIES_API_KEY", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
