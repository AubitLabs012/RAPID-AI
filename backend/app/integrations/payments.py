from app.config import get_settings


class StripeClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def is_configured(self) -> bool:
        return bool(self.settings.stripe_api_key)
