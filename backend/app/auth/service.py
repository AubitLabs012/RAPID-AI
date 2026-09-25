import hashlib
import hmac
import time
from uuid import uuid4

from pydantic import BaseModel

from app.auth.jwt import decode_jwt, encode_jwt
from app.config import get_settings
from app.db.repositories import UserRepository


class TokenBundle(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class AuthService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.user_repository = UserRepository()

    def signup(self, username: str, password: str, role: str, display_name: str) -> TokenBundle:
        existing_user = self.user_repository.get_by_username(username)
        if existing_user is not None:
            raise ValueError("User already exists")

        user_id = self._build_user_id(username)
        self.user_repository.create(
            {
                "id": user_id,
                "username": username,
                "role": role,
                "display_name": display_name,
                "password_hash": self._hash_password(password),
            }
        )
        return self._issue_token(
            {
                "id": user_id,
                "username": username,
                "role": role,
                "display_name": display_name,
            }
        )

    def login(self, username: str, password: str, role: str) -> TokenBundle:
        user = self.user_repository.get_by_username(username)
        if user is None:
            raise ValueError("User not found")
        if user.get("role") != role:
            raise ValueError("Role mismatch")
        if not self._verify_password(password, user.get("password_hash", "")):
            raise ValueError("Invalid credentials")
        return self._issue_token(user)

    def _issue_token(self, user: dict) -> TokenBundle:
        now = int(time.time())
        payload = {
            "sub": user["id"],
            "username": user["username"],
            "role": user["role"],
            "iat": now,
            "exp": now + (self.settings.jwt_expiry_minutes * 60),
            "iss": self.settings.jwt_issuer,
            "aud": self.settings.jwt_audience,
            "jti": str(uuid4()),
        }
        access_token = encode_jwt(payload)
        return TokenBundle(
            access_token=access_token,
            expires_in=self.settings.jwt_expiry_minutes * 60,
            user={"id": user["id"], "username": user["username"], "role": user["role"]},
        )

    def verify_access_token(self, token: str) -> dict:
        payload = decode_jwt(token)
        return {
            "id": payload["sub"],
            "username": payload["username"],
            "role": payload.get("role", "user"),
        }

    def _build_user_id(self, username: str) -> str:
        return hashlib.sha1(username.lower().encode("utf-8")).hexdigest()[:16]

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(f"{self.settings.jwt_secret}:{password}".encode("utf-8")).hexdigest()

    def _verify_password(self, password: str, stored_hash: str) -> bool:
        if not stored_hash:
            return False
        return hmac.compare_digest(self._hash_password(password), stored_hash)
