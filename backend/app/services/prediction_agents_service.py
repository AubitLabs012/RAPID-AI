from __future__ import annotations

import json
import math
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.api.schemas import PredictionAgentRequest
from app.integrations.ai_clients import OpenAIClient
from app.services.live_ocean_service import LiveOceanService


AGENTS: dict[str, dict[str, str]] = {
    "marine": {
        "letter": "🌊",
        "name": "Marine Agent",
        "focus": "Ocean monitoring",
        "goal": "Understand current marine and environmental conditions.",
        "tools": "Python, xarray, live ocean APIs",
        "formula": "Mean, Standard Deviation, Z-score, Percentage Change",
    },
    "analytics": {
        "letter": "📊",
        "name": "Analytics Agent",
        "focus": "Data analysis",
        "goal": "Analyze biodiversity and ocean-health patterns.",
        "tools": "Pandas, SQL, statistics",
        "formula": "Pearson Correlation, Shannon Diversity Index, Simpson Diversity Index",
    },
    "reasoning": {
        "letter": "🧠",
        "name": "Reasoning Agent",
        "focus": "Scientific reasoning",
        "goal": "Connect evidence and explain why something may be happening.",
        "tools": "LLM plus RAPID-AI data",
        "formula": "Bayes' Theorem",
    },
    "intelligence": {
        "letter": "🔮",
        "name": "Intelligence Agent",
        "focus": "Prediction",
        "goal": "Forecast trends, detect anomalies, and estimate risks.",
        "tools": "ML, XGBoost, Scikit-learn",
        "formula": "Linear/Multiple Regression, Moving Average, RMSE/MAE",
    },
    "synthesis": {
        "letter": "🧩",
        "name": "Synthesis Agent",
        "focus": "Final intelligence",
        "goal": "Combine everything into a useful answer, report, or alert.",
        "tools": "LLM plus report templates",
        "formula": "Weighted Score / Weighted Average",
    },
}

MARKERS_FILE = Path(__file__).resolve().parents[3] / "src" / "marine-markers.json"


class PredictionAgentsService:
    def __init__(self) -> None:
        self.llm = OpenAIClient()
        self.live_ocean = LiveOceanService()

    def list_agents(self) -> list[dict[str, str]]:
        return [{"id": agent_id, **agent} for agent_id, agent in AGENTS.items()]

    def analyze(self, user: dict[str, Any], payload: PredictionAgentRequest) -> dict[str, Any]:
        agent = AGENTS[payload.agent_id]
        live_regions = self.live_ocean.regions()
        markers = self._dataset_markers(payload)
        formula_evidence = self._formula_evidence(payload.agent_id, markers, live_regions, payload.prompt)
        prompt = self._build_prompt(agent, payload, live_regions, markers, formula_evidence)
        response = self._sanitize_agent_response(self.llm.generate_response(
            prompt,
            {
                "topic": f"RAPID-AI {agent['name']} prediction analysis",
                "response_style": "agent_debate_with_math",
                "agent": agent,
                "live_regions": live_regions,
                "formula_evidence": formula_evidence,
                "user_context": payload.context,
            },
        ))

        return {
            "request_id": str(uuid4()),
            "agent_id": payload.agent_id,
            "agent": {"id": payload.agent_id, **agent},
            "response": response,
            "live_regions": live_regions,
            "formula_evidence": formula_evidence,
            "generated_at": datetime.utcnow().isoformat(),
            "user_id": user.get("id"),
        }

    def _build_prompt(
        self,
        agent: dict[str, str],
        payload: PredictionAgentRequest,
        live_regions: list[dict[str, Any]],
        markers: list[dict[str, Any]],
        formula_evidence: dict[str, Any],
    ) -> str:
        return (
            f"You are the {agent['letter']} agent in RAPID-AI: {agent['name']}.\n"
            f"Focus: {agent['focus']}.\n"
            f"Goal: {agent['goal']}\n"
            f"Expected tools/approach: {agent['tools']}.\n"
            f"Required mathematical method: {agent['formula']}.\n"
            "Use the same shared RAPID-AI LLM, but answer only from this agent role.\n"
            "Act like a scientific debate participant: reference previous agent outputs if present, "
            "agree or challenge one point, then add your own calculation-backed conclusion.\n"
            "Use the formula evidence below explicitly. Do not pretend exact values exist if they are missing.\n"
            "When formula evidence contains computed values, quote those values exactly instead of recomputing them.\n"
            "For Bayes, use posterior_probability_area_effect as the final posterior probability.\n"
            "Reasoning must explain causality and uncertainty. Intelligence must forecast trend/risk using regression and error evidence. "
            "Synthesis must combine all earlier agents into one final end prediction for this Predictions room.\n"
            "Use ASCII units/symbols like C, sigma, and +/- so the Predictions room renders cleanly.\n"
            "Do not use markdown, asterisks, or bullet symbols. Use plain labels only: Position, Formula Evidence, Area Effect, Risk Forecast, Next action.\n\n"
            f"Live ocean snapshots: {json.dumps(live_regions, ensure_ascii=True)}\n"
            f"RAPID-AI marker dataset sample/counts: {json.dumps(self._marker_summary(markers), ensure_ascii=True)}\n"
            f"Formula evidence for this agent: {json.dumps(formula_evidence, ensure_ascii=True)}\n"
            f"Extra frontend context: {json.dumps(payload.context, ensure_ascii=True)}\n"
            f"User request: {payload.prompt}"
        )

    def _dataset_markers(self, payload: PredictionAgentRequest) -> list[dict[str, Any]]:
        uploaded = payload.context.get("uploaded_locations") if isinstance(payload.context, dict) else None
        if isinstance(uploaded, list) and uploaded:
            return [item for item in uploaded if isinstance(item, dict)]

        try:
            loaded = json.loads(MARKERS_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        return loaded if isinstance(loaded, list) else []

    def _sanitize_agent_response(self, response: str) -> str:
        cleaned = response.replace("*", "")
        cleaned = re.sub(r"(?m)^\s*[-•]\s+", "", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def _formula_evidence(
        self,
        agent_id: str,
        markers: list[dict[str, Any]],
        live_regions: list[dict[str, Any]],
        prompt: str,
    ) -> dict[str, Any]:
        if agent_id == "marine":
            return self._marine_formula(markers)
        if agent_id == "analytics":
            return self._analytics_formula(markers)
        if agent_id == "reasoning":
            return self._reasoning_formula(markers, prompt)
        if agent_id == "intelligence":
            return self._intelligence_formula(markers)
        if agent_id == "synthesis":
            return self._synthesis_formula(markers, live_regions)
        return {}

    def _marine_formula(self, markers: list[dict[str, Any]]) -> dict[str, Any]:
        sst = self._metric_values(markers, "SST")
        chlorophyll = self._metric_values(markers, "Chlorophyll")
        return {
            "method": "Mean, Standard Deviation, Z-score, Percentage Change",
            "sst": self._series_stats(sst),
            "chlorophyll": self._series_stats(chlorophyll),
            "interpretation": "Positive SST z-score or rising percentage change implies wider thermal stress if temperature increases.",
        }

    def _analytics_formula(self, markers: list[dict[str, Any]]) -> dict[str, Any]:
        paired = [(self._metric_value(marker, "SST"), self._metric_value(marker, "Salinity")) for marker in markers]
        pairs = [(sst, salinity) for sst, salinity in paired if sst is not None and salinity is not None]
        region_counts = self._counts(marker.get("region", "Unknown") for marker in markers if marker.get("type") == "biodiversity")
        return {
            "method": "Pearson Correlation, Shannon Diversity Index, Simpson Diversity Index",
            "sst_salinity_pearson_r": round(self._pearson([x for x, _ in pairs], [y for _, y in pairs]), 4) if len(pairs) >= 2 else None,
            "paired_records": len(pairs),
            "biodiversity_region_counts": region_counts,
            "shannon_diversity_index": round(self._shannon(region_counts), 4),
            "simpson_diversity_index": round(self._simpson(region_counts), 4),
            "interpretation": "Higher diversity spread across regions improves resilience; correlation shows whether warmer points also carry salinity stress.",
        }

    def _reasoning_formula(self, markers: list[dict[str, Any]], prompt: str) -> dict[str, Any]:
        sst = self._metric_values(markers, "SST")
        prior = len([value for value in sst if value >= 29.5]) / len(sst) if sst else 0.35
        increase = self._extract_temperature_increase(prompt)
        likelihood_stress = min(0.92, 0.55 + (increase * 0.14))
        likelihood_no_stress = max(0.08, 0.34 - (increase * 0.05))
        denominator = (likelihood_stress * prior) + (likelihood_no_stress * (1 - prior))
        posterior = (likelihood_stress * prior / denominator) if denominator else 0
        return {
            "method": "Bayes' Theorem",
            "assumed_temperature_increase_c": increase,
            "prior_probability_warm_stress": round(prior, 4),
            "likelihood_effect_given_stress": round(likelihood_stress, 4),
            "likelihood_effect_without_stress": round(likelihood_no_stress, 4),
            "marginal_probability_increase": round(denominator, 4),
            "posterior_probability_area_effect": round(posterior, 4),
            "formula": "P(effect|increase) = P(increase|effect) * P(effect) / P(increase)",
        }

    def _intelligence_formula(self, markers: list[dict[str, Any]]) -> dict[str, Any]:
        sst_markers = [marker for marker in markers if self._metric_value(marker, "SST") is not None]
        x = [float(marker.get("lng", 0)) for marker in sst_markers]
        y = [self._metric_value(marker, "SST") or 0 for marker in sst_markers]
        regression = self._linear_regression(x, y)
        predictions = [regression["intercept"] + regression["slope"] * value for value in x] if regression else []
        errors = [actual - predicted for actual, predicted in zip(y, predictions)]
        return {
            "method": "Linear/Multiple Regression, Moving Average, RMSE/MAE",
            "linear_regression_sst_vs_longitude": regression,
            "moving_average_last_3_sst": round(sum(y[-3:]) / 3, 4) if len(y) >= 3 else None,
            "rmse": round(math.sqrt(sum(error * error for error in errors) / len(errors)), 4) if errors else None,
            "mae": round(sum(abs(error) for error in errors) / len(errors), 4) if errors else None,
            "interpretation": "Regression is a first-pass forecast surface; RMSE/MAE show how uncertain that simple forecast is.",
        }

    def _synthesis_formula(self, markers: list[dict[str, Any]], live_regions: list[dict[str, Any]]) -> dict[str, Any]:
        sst_stats = self._series_stats(self._metric_values(markers, "SST"))
        chlorophyll_stats = self._series_stats(self._metric_values(markers, "Chlorophyll"))
        biodiversity_count = len([marker for marker in markers if marker.get("type") == "biodiversity"])
        live_risk = self._live_risk_score(live_regions)
        thermal_score = min(100, max(0, ((sst_stats.get("mean") or 28.0) - 26.0) / 4.0 * 100))
        productivity_score = min(100, max(0, (chlorophyll_stats.get("mean") or 0.0) / 0.35 * 100))
        biodiversity_score = min(100, biodiversity_count / 15 * 100)
        weighted_score = thermal_score * 0.35 + productivity_score * 0.2 + biodiversity_score * 0.25 + live_risk * 0.2
        return {
            "method": "Weighted Score / Weighted Average",
            "weights": {"thermal": 0.35, "productivity": 0.2, "biodiversity": 0.25, "live_risk": 0.2},
            "component_scores": {
                "thermal": round(thermal_score, 2),
                "productivity": round(productivity_score, 2),
                "biodiversity": round(biodiversity_score, 2),
                "live_risk": round(live_risk, 2),
            },
            "weighted_area_risk_score": round(weighted_score, 2),
        }

    def _marker_summary(self, markers: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "total_markers": len(markers),
            "type_counts": self._counts(marker.get("type", "unknown") for marker in markers),
            "region_counts": self._counts(marker.get("region", "unknown") for marker in markers),
            "sample_markers": markers[:8],
        }

    def _metric_values(self, markers: list[dict[str, Any]], key: str) -> list[float]:
        values = [self._metric_value(marker, key) for marker in markers]
        return [value for value in values if value is not None]

    def _metric_value(self, marker: dict[str, Any], key: str) -> float | None:
        metrics = marker.get("metrics") if isinstance(marker.get("metrics"), dict) else {}
        value = metrics.get(key)
        if value is None and key == "SST":
            value = metrics.get("Temperature")
        if value is None:
            return None
        match = re.search(r"-?\d+(?:\.\d+)?", str(value))
        return float(match.group(0)) if match else None

    def _series_stats(self, values: list[float]) -> dict[str, Any]:
        if not values:
            return {"count": 0, "mean": None, "standard_deviation": None, "latest_z_score": None, "percentage_change": None}
        mean = sum(values) / len(values)
        std = math.sqrt(sum((value - mean) ** 2 for value in values) / len(values))
        latest_z = (values[-1] - mean) / std if std else 0
        percentage_change = ((values[-1] - values[0]) / values[0] * 100) if values[0] else 0
        return {
            "count": len(values),
            "mean": round(mean, 4),
            "standard_deviation": round(std, 4),
            "latest_z_score": round(latest_z, 4),
            "percentage_change": round(percentage_change, 4),
            "min": round(min(values), 4),
            "max": round(max(values), 4),
        }

    def _pearson(self, x: list[float], y: list[float]) -> float:
        if len(x) != len(y) or len(x) < 2:
            return 0.0
        mean_x = sum(x) / len(x)
        mean_y = sum(y) / len(y)
        numerator = sum((a - mean_x) * (b - mean_y) for a, b in zip(x, y))
        denom_x = math.sqrt(sum((a - mean_x) ** 2 for a in x))
        denom_y = math.sqrt(sum((b - mean_y) ** 2 for b in y))
        return numerator / (denom_x * denom_y) if denom_x and denom_y else 0.0

    def _shannon(self, counts: dict[str, int]) -> float:
        total = sum(counts.values())
        return -sum((count / total) * math.log(count / total) for count in counts.values() if total and count)

    def _simpson(self, counts: dict[str, int]) -> float:
        total = sum(counts.values())
        return 1 - sum((count / total) ** 2 for count in counts.values()) if total else 0

    def _linear_regression(self, x: list[float], y: list[float]) -> dict[str, float] | None:
        if len(x) != len(y) or len(x) < 2:
            return None
        mean_x = sum(x) / len(x)
        mean_y = sum(y) / len(y)
        denominator = sum((value - mean_x) ** 2 for value in x)
        if not denominator:
            return None
        slope = sum((a - mean_x) * (b - mean_y) for a, b in zip(x, y)) / denominator
        intercept = mean_y - slope * mean_x
        return {"slope": round(slope, 6), "intercept": round(intercept, 4)}

    def _counts(self, values: Any) -> dict[str, int]:
        counts: dict[str, int] = {}
        for value in values:
            key = str(value or "Unknown")
            counts[key] = counts.get(key, 0) + 1
        return counts

    def _extract_temperature_increase(self, prompt: str) -> float:
        lowered = prompt.lower().replace("°", "deg")
        match = re.search(r"(\d+(?:\.\d+)?)\s*(?:c|°c|degree|degrees)", lowered)
        match = re.search(r"(\d+(?:\.\d+)?)\s*(?:c|degc|deg|degree|degrees)", lowered)
        if match and any(word in lowered for word in ["increase", "rise", "warmer", "heat"]):
            return float(match.group(1))
        return 1.0 if any(word in lowered for word in ["increase", "rise", "warmer", "heat"]) else 0.5

    def _live_risk_score(self, live_regions: list[dict[str, Any]]) -> float:
        scores = {"Low": 25.0, "Moderate": 58.0, "High": 86.0}
        values = [scores.get(str(region.get("risk")), 40.0) for region in live_regions]
        return sum(values) / len(values) if values else 50.0
