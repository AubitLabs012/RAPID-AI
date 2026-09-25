from __future__ import annotations

from datetime import datetime
from typing import Any

from app.transformations.normalize import MarineObservation


MODEL_VERSION = "maris-ai-baseline-2026.09"


class MarinePredictor:
    def predict(self, observations: list[MarineObservation]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        predictions: list[dict[str, Any]] = []
        alerts: list[dict[str, Any]] = []
        anomaly_flags = self._anomaly_flags(observations)

        for index, observation in enumerate(observations):
            health_score = self._ocean_health_score(observation)
            fish_abundance = self._fish_abundance(observation)
            species_richness = self._species_richness(observation)
            bleaching_risk = self._coral_bleaching_risk(observation)
            anomaly_score = 1.0 if anomaly_flags[index] else 0.0

            prediction_values = {
                "ocean_health_score": health_score,
                "fish_abundance_prediction": fish_abundance,
                "species_richness": species_richness,
                "coral_bleaching_risk": bleaching_risk,
                "marine_anomaly_detection": anomaly_score,
            }

            for prediction_type, value in prediction_values.items():
                predictions.append(self._prediction(observation, prediction_type, value))

            alerts.extend(self._alerts_for_observation(observation, prediction_values))

        return predictions, alerts

    def _prediction(self, observation: MarineObservation, prediction_type: str, value: float) -> dict[str, Any]:
        return {
            "latitude": observation.latitude,
            "longitude": observation.longitude,
            "timestamp": observation.timestamp,
            "prediction_type": prediction_type,
            "value": round(float(value), 4),
            "confidence": 0.78,
            "model_version": MODEL_VERSION,
            "metadata": {
                "source": observation.source,
                "features": observation.features,
            },
        }

    def _alerts_for_observation(self, observation: MarineObservation, values: dict[str, float]) -> list[dict[str, Any]]:
        alerts: list[dict[str, Any]] = []
        if values["coral_bleaching_risk"] >= 0.72:
            alerts.append(self._alert(observation, "high", "coral_bleaching_risk", "Elevated coral bleaching risk detected."))
        if values["ocean_health_score"] < 45:
            alerts.append(self._alert(observation, "medium", "ocean_health_score", "Ocean health score is below operational threshold."))
        if values["marine_anomaly_detection"] >= 1:
            alerts.append(self._alert(observation, "medium", "marine_anomaly", "Marine anomaly detected in the latest observation batch."))
        return alerts

    def _alert(self, observation: MarineObservation, severity: str, alert_type: str, message: str) -> dict[str, Any]:
        return {
            "latitude": observation.latitude,
            "longitude": observation.longitude,
            "timestamp": observation.timestamp if isinstance(observation.timestamp, datetime) else datetime.utcnow(),
            "severity": severity,
            "alert_type": alert_type,
            "message": message,
            "active": True,
            "metadata": {"source": observation.source, "features": observation.features},
        }

    def _ocean_health_score(self, observation: MarineObservation) -> float:
        score = 100.0
        if observation.sea_surface_temperature is not None:
            score -= max(0.0, observation.sea_surface_temperature - 29) * 6
        if observation.chlorophyll is not None:
            score -= max(0.0, observation.chlorophyll - 5) * 4
        if observation.dissolved_oxygen is not None:
            score -= max(0.0, 5 - observation.dissolved_oxygen) * 10
        if observation.salinity is not None:
            score -= abs(observation.salinity - 35) * 1.5
        return max(0.0, min(100.0, score))

    def _fish_abundance(self, observation: MarineObservation) -> float:
        base = float(observation.fish_count or 0)
        chlorophyll_signal = observation.features.get("chlorophyll_signal", observation.chlorophyll or 0)
        thermal_penalty = max(0.0, (observation.sea_surface_temperature or 27) - 30) * 8
        return max(0.0, base + (chlorophyll_signal * 12) - thermal_penalty)

    def _species_richness(self, observation: MarineObservation) -> float:
        if observation.species_name:
            return 1.0 + min(float(observation.fish_count or 1) / 100, 5)
        return max(0.0, (observation.chlorophyll or 0) * 0.8)

    def _coral_bleaching_risk(self, observation: MarineObservation) -> float:
        temperature = observation.sea_surface_temperature or 0
        oxygen_stress = observation.features.get("oxygen_stress", 0)
        risk = ((temperature - 28) * 0.18) + (oxygen_stress * 0.08)
        return max(0.0, min(1.0, risk))

    def _anomaly_flags(self, observations: list[MarineObservation]) -> list[bool]:
        if len(observations) < 4:
            return [False for _ in observations]

        try:
            import pandas as pd
            from sklearn.ensemble import IsolationForest
        except ImportError:
            return [False for _ in observations]

        frame = pd.DataFrame(
            [
                {
                    "sst": observation.sea_surface_temperature or 0,
                    "chlorophyll": observation.chlorophyll or 0,
                    "salinity": observation.salinity or 0,
                    "oxygen": observation.dissolved_oxygen or 0,
                    "fish_count": observation.fish_count or 0,
                    "depth": observation.depth or 0,
                }
                for observation in observations
            ]
        )
        labels = IsolationForest(contamination="auto", random_state=11).fit_predict(frame)
        return [label == -1 for label in labels]
