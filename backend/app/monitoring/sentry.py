from app.config import get_settings
from app.monitoring.logging import configure_logging


def configure_sentry() -> None:
    configure_logging()
    settings = get_settings()
    if not settings.sentry_dsn:
        return

    try:
        import sentry_sdk
    except ImportError:
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.2,
    )
