from datetime import datetime

from app.api.schemas import GameActionRequest
from app.db.repositories import GameRepository, UserRepository


class GameService:
    def __init__(self) -> None:
        self.user_repository = UserRepository()
        self.game_repository = GameRepository()

    def process_result(self, payload: GameActionRequest) -> dict:
        rewards = self._calculate_rewards(payload.result, payload.score)
        profile = self.user_repository.update_rewards(
            user_id=payload.user_id,
            coins=rewards["coins"],
            stars=rewards["stars"],
        )

        event = {
            "game_type": payload.game_type,
            "result": payload.result,
            "score": payload.score,
            "rewards": rewards,
            "processed_at": datetime.utcnow().isoformat(),
        }
        self.game_repository.create_event(payload.user_id, event)

        return {
            "rewards": rewards,
            "profile": profile,
            "event": event,
        }

    def _calculate_rewards(self, result: str, score: int) -> dict:
        score_bonus = min(score // 100, 25)
        if result == "win":
            return {"coins": 25 + score_bonus, "stars": 3}
        if result == "draw":
            return {"coins": 10 + score_bonus, "stars": 1}
        return {"coins": max(2, score_bonus), "stars": 0}
