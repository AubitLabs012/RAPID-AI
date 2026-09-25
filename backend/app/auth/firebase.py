from pathlib import Path

from app.config import get_settings


class FirebaseAuthProvider:
    def __init__(self) -> None:
        self.settings = get_settings()

    def is_configured(self) -> bool:
        return bool(self.settings.firebase_project_id and self.settings.firebase_credentials_path)

    def verify_id_token(self, id_token: str) -> dict:
        if not self.is_configured():
            raise ValueError("Firebase authentication is not configured")

        credentials_path = Path(self.settings.firebase_credentials_path)
        if not credentials_path.exists():
            raise ValueError("Firebase credentials file was not found")

        try:
            import firebase_admin
            from firebase_admin import auth, credentials
        except ImportError as exc:
            raise ValueError("firebase-admin dependency is not installed") from exc

        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.Certificate(str(credentials_path)))

        decoded = auth.verify_id_token(id_token)
        return {
            "sub": decoded.get("uid"),
            "email": decoded.get("email"),
            "role": decoded.get("role", "user"),
            "auth_provider": "firebase",
        }
