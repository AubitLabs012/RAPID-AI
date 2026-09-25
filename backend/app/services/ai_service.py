from datetime import datetime
from uuid import uuid4

from app.api.schemas import AIResponseRequest
from app.cache.redis_cache import CacheService
from app.db.repositories import AIResponseRepository
from app.integrations.ai_clients import OpenAIClient, VoiceClient


class AIService:
    def __init__(self) -> None:
        self.cache = CacheService()
        self.repository = AIResponseRepository()
        self.openai_client = OpenAIClient()
        self.voice_client = VoiceClient()

    def process_prompt(self, user: dict, payload: AIResponseRequest) -> dict:
        cache_key = f"ai:{user['id']}:{payload.prompt.strip().lower()}"
        cached = self.cache.get(cache_key)
        if cached:
            return {"response": cached, "cached": True}

        text_response = self.openai_client.generate_response(payload.prompt, payload.context)
        voice_preview = self.voice_client.synthesize_preview(text_response) if payload.use_voice else None

        result = {
            "request_id": str(uuid4()),
            "response": text_response,
            "voice_preview": voice_preview,
            "cached": False,
            "generated_at": datetime.utcnow().isoformat(),
        }
        self.repository.save(result["request_id"], {"user_id": user["id"], **result})
        self.cache.set(cache_key, text_response, ttl_seconds=120)
        return result
