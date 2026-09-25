from __future__ import annotations

from app.ai.predictors import MarinePredictor
from app.repositories.marine_repository import MarineRepository
from app.transformations.normalize import MarineObservation


class MarineAIPipeline:
    def __init__(self) -> None:
        self.predictor = MarinePredictor()
        self.repository = MarineRepository()

    async def run(self, observations: list[MarineObservation]) -> dict[str, int]:
        predictions, alerts = self.predictor.predict(observations)
        prediction_count = await self.repository.save_predictions(predictions)
        alert_count = await self.repository.save_alerts(alerts)
        return {"predictions": prediction_count, "alerts": alert_count}
