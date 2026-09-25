import json
import logging
from urllib import error, request

from app.config import get_settings


logger = logging.getLogger(__name__)


class OpenAIClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def generate_response(self, prompt: str, context: dict) -> str:
        if self.settings.ai_provider == "groq" and self.settings.groq_api_key:
            try:
                return self._generate_with_groq(prompt, context)
            except ValueError as exc:
                logger.warning("Groq generation failed: %s", exc)
                return self._build_fallback_response(prompt, context, "Groq was unavailable")

        if self.settings.ai_provider == "gemini" and self.settings.gemini_api_key:
            try:
                return self._generate_with_gemini(prompt, context)
            except ValueError as exc:
                logger.warning("Gemini generation failed: %s", exc)
                return self._build_fallback_response(prompt, context, "Gemini was unavailable")

        if self.settings.openai_api_key:
            return "OpenAI API key is configured, but the live OpenAI request flow is not implemented yet."

        return self._build_fallback_response(prompt, context, "No external AI provider is configured")

    def _generate_with_groq(self, prompt: str, context: dict) -> str:
        topic = context.get("topic", "disaster intelligence")
        response_style = context.get("response_style", "")
        is_agent_debate = response_style == "agent_debate_with_math"
        system_instruction = (
            "You are RAPID-AI, a disaster intelligence assistant. Give clear, concise, practical answers. "
            "Use the supplied region and scenario context when relevant. Treat sample risk values as illustrative, "
            "never present them as verified live warnings or forecasts, and do not invent event records, statistics, "
            "locations, or source citations. Say when the provided context does not contain the requested fact. "
            + (
                "Reply fast in plain language. For RAPID-AI agent debate, use the provided formula evidence, "
                "quote computed values exactly, be analytical, use ASCII units/symbols like C, sigma, and +/-, "
                "do not use markdown, do not use asterisks, and keep the response under 130 words."
                if is_agent_debate
                else "Reply in plain language. Keep answers under 120 words unless the user asks for detail."
            )
        )
        payload = {
            "model": self.settings.groq_model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {
                    "role": "user",
                    "content": (
                        f"Context topic: {topic}\n"
                        f"Response style: {response_style}\n"
                        f"Extra context: {json.dumps(context, ensure_ascii=True)}\n"
                        f"User prompt: {prompt}"
                    ),
                },
            ],
            "temperature": 0.25,
            "max_completion_tokens": 300 if is_agent_debate else 160,
        }
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=body,
            headers={
                "Authorization": f"Bearer {self.settings.groq_api_key}",
                "Content-Type": "application/json",
                "User-Agent": "RAPID-AI/1.0",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=20) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ValueError(f"Groq request failed with status {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise ValueError(f"Groq request failed: {exc.reason}") from exc

        choices = response_payload.get("choices") or []
        if not choices:
            raise ValueError("Groq returned no choices")

        content = choices[0].get("message", {}).get("content", "")
        if not content:
            raise ValueError("Groq returned an empty response")

        return content.strip()

    def analyze_image_with_groq(self, prompt: str, image_data_url: str) -> str:
        """Send an in-memory image to Groq's vision model without saving it locally."""
        payload = {
            "model": self.settings.groq_vision_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are RAPID-AI, a cautious disaster-image assistant. Describe only visible conditions, "
                        "damage, and scene details; distinguish observations from uncertain interpretation. Do not "
                        "claim an exact location from pixels, infer identity, age, sex, ethnicity, or population "
                        "statistics, or call the image a verified report. If people are plainly visible, an approximate "
                        "visual count may be given with an uncertainty note. Do not diagnose injuries. Explain that "
                        "a human responder should verify important details. Keep the answer under 180 words."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                },
            ],
            "temperature": 0.2,
            "max_completion_tokens": 360,
        }
        req = request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.settings.groq_api_key}",
                "Content-Type": "application/json",
                "User-Agent": "RAPID-AI/1.0",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=45) as response:
                result = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            logger.warning("Groq vision request failed with status %s", exc.code)
            raise ValueError("Groq vision request failed") from exc
        except error.URLError as exc:
            logger.warning("Groq vision request failed: %s", exc.reason)
            raise ValueError("Groq vision request failed") from exc
        choices = result.get("choices") or []
        content = choices[0].get("message", {}).get("content", "") if choices else ""
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Groq returned no image analysis")
        return content.strip()

    def _build_fallback_response(self, prompt: str, context: dict, reason: str) -> str:
        topic = context.get("topic") or "your request"
        if context.get("response_style") == "agent_debate_with_math":
            agent = context.get("agent") if isinstance(context.get("agent"), dict) else {}
            evidence = context.get("formula_evidence") if isinstance(context.get("formula_evidence"), dict) else {}
            agent_name = str(agent.get("name", "RAPID-AI agent"))
            method = evidence.get("method", agent.get("formula", "RAPID-AI method"))
            if "posterior_probability_area_effect" in evidence:
                return (
                    "Position: Reasoning continues from the earlier evidence and treats the warming scenario as moderate but meaningful.\n"
                    f"Formula Evidence: Bayes posterior_probability_area_effect = {evidence.get('posterior_probability_area_effect')}; "
                    f"prior = {evidence.get('prior_probability_warm_stress')}; marginal = {evidence.get('marginal_probability_increase')}.\n"
                    "Area Effect: A +1 C scenario raises thermal-stress likelihood across Arabian Sea, Bay of Bengal, and Lakshadweep, but uncertainty remains because biodiversity resilience differs by region.\n"
                    "Risk Forecast: Moderate system-wide risk with localized high stress near already-warm reef and coastal zones."
                )
            if "linear_regression_sst_vs_longitude" in evidence:
                return (
                    "Position: Intelligence combines the earlier reasoning with the forecast error evidence.\n"
                    f"Formula Evidence: Regression = {evidence.get('linear_regression_sst_vs_longitude')}; "
                    f"moving_average_last_3_sst = {evidence.get('moving_average_last_3_sst')}; RMSE = {evidence.get('rmse')}; MAE = {evidence.get('mae')}.\n"
                    "Area Effect: The warming scenario increases anomaly risk and can shift biodiversity distribution toward cooler or deeper zones.\n"
                    "Risk Forecast: Expect higher thermal stress, possible chlorophyll disruption, and poorer ocean-health stability if the trend persists."
                )
            if "weighted_area_risk_score" in evidence:
                return (
                    "Position: Synthesis combines Marine, Analytics, Reasoning, and Intelligence into the final prediction for this room.\n"
                    f"Formula Evidence: Weighted area risk score = {evidence.get('weighted_area_risk_score')} using weights {evidence.get('weights')}.\n"
                    "Area Effect: A +1 C SST increase would pressure Arabian Sea and Bay of Bengal productivity, stress Lakshadweep reef habitats, and reduce overall ocean-health stability.\n"
                    "End Prediction: Treat the whole area as elevated risk. Monitor SST, chlorophyll, salinity, and biodiversity markers before issuing any operational alert."
                )
            evidence_preview = json.dumps(evidence, ensure_ascii=True)[:420]
            return (
                f"Position: {agent_name} completed this stage using RAPID-AI local calculations while the live provider was delayed.\n"
                f"Formula Evidence: Method = {method}. Evidence = {evidence_preview}.\n"
                "Area Effect: Treat the scenario as provisional; compare SST, chlorophyll, biodiversity, "
                "and ocean-health markers before escalating.\n"
                "Next action: Keep the final prediction in this room and rerun the chain when fresh data arrives."
            )
        return (
            f"RAPID-AI processed {topic}. Prompt received: {prompt}. "
            f"This is the local fallback response because {reason.lower()}."
        )

    def _generate_with_gemini(self, prompt: str, context: dict) -> str:
        topic = context.get("topic", "general assistance")
        response_style = context.get("response_style", "")
        system_instruction = (
            "You are Aubit, a helpful AI companion for study, games, and voice interactions. "
            "Respond clearly, keep explanations practical, and adapt to the user's topic. "
            "If response_style is direct_answer and the user is asking an arithmetic or logic question, "
            "give the final answer first and keep the reply brief. Do not add a long explanation unless asked."
        )
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.gemini_model}:generateContent?key={self.settings.gemini_api_key}"
        )
        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                f"Context topic: {topic}\n"
                                f"Extra context: {json.dumps(context, ensure_ascii=True)}\n"
                                f"User prompt: {prompt}"
                            )
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.9,
                "maxOutputTokens": 512,
            },
        }
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=20) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ValueError(f"Gemini request failed with status {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise ValueError(f"Gemini request failed: {exc.reason}") from exc

        candidates = response_payload.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_parts = [part.get("text", "") for part in parts if part.get("text")]
        if not text_parts:
            raise ValueError("Gemini returned an empty response")

        return "\n".join(text_parts).strip()


class VoiceClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def synthesize_preview(self, text: str) -> dict:
        if self.settings.elevenlabs_api_key:
            return {
                "provider": "elevenlabs",
                "status": "configured",
                "message": "Wire the real ElevenLabs request here.",
            }

        return {
            "provider": "local-fallback",
            "status": "simulated",
            "preview_text": text[:120],
        }
