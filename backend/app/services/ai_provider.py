from __future__ import annotations

import json
import logging
import os
import random
import time
from typing import Protocol

from app.ai.base import CampaignOutput
from app.services.groq_service import generate_ai_response

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

_GENERATION_SYSTEM = (
    "You are a creative director running an AI battle room. "
    "Participants submit a creative prompt and you produce the best "
    "possible creative output for that prompt in the context of the "
    "battle theme. Your output must be: specific (references the theme "
    "directly), compact (100-180 words), vivid, and original. "
    "Do not explain or narrate. Just produce the creative piece."
)


class AIProvider(Protocol):
    def generate(self, prompt: str, theme: str) -> CampaignOutput: ...
    def judge(self, output: str, theme: str) -> tuple[float, str]: ...


def _groq_api_key(*, app=None) -> str:
    if app is not None:
        return (app.config.get("GROQ_API_KEY") or "").strip()
    return (os.environ.get("GROQ_API_KEY") or "").strip()


def _gemini_api_key(*, app=None) -> str:
    if app is not None:
        return (app.config.get("GEMINI_API_KEY") or "").strip()
    return (os.environ.get("GEMINI_API_KEY") or "").strip()


def _gemini_model_name(*, app=None) -> str:
    if app is not None:
        model = (app.config.get("GEMINI_MODEL") or "").strip()
        if model:
            return model
    return (os.environ.get("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL).strip()


def _parse_campaign_json(text: str, *, theme: str, prompt: str) -> CampaignOutput:
    try:
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text)
        return {
            "title": str(data.get("title", theme[:40])),
            "tagline": str(data.get("tagline", "")),
            "campaign_text": str(data.get("campaign_text", text)),
        }
    except (json.JSONDecodeError, TypeError, KeyError):
        return {
            "title": theme[:48] or "Campaign",
            "tagline": prompt[:80],
            "campaign_text": text,
        }


class GroqProvider:
    def __init__(self, *, app=None) -> None:
        self._app = app

    def generate(self, prompt: str, theme: str) -> CampaignOutput:
        user_prompt = (
            f"{_GENERATION_SYSTEM}\n\n"
            f"Battle theme: {theme}\n\nParticipant prompt: {prompt}\n\n"
            "Produce the creative output now. Return JSON with keys: "
            'title, tagline, campaign_text.'
        )
        text = generate_ai_response(user_prompt, app=self._app)
        return _parse_campaign_json(text, theme=theme, prompt=prompt)

    def judge(self, output: str, theme: str) -> tuple[float, str]:
        judge_prompt = (
            "You are a strict creative battle judge.\n\n"
            f"Battle theme: {theme}\n\n"
            f"Submitted output:\n{output}\n\n"
            "Score 0-100 based on:\n"
            "- Relevance to theme (40%)\n"
            "- Creativity and originality (35%)\n"
            "- Conciseness and impact (25%)\n\n"
            'Respond ONLY in this exact JSON: {"score": <0-100>, '
            '"reason": "<one sentence>"}'
        )
        raw = generate_ai_response(judge_prompt, app=self._app)
        try:
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw)
            return float(data["score"]), str(data["reason"])
        except (json.JSONDecodeError, TypeError, KeyError, ValueError) as exc:
            logger.warning("Groq judge parse failed (%s); using heuristic score", exc)
            return MockProvider().judge(output, theme)


class GeminiProvider:
    def __init__(self, *, api_key: str, model_name: str | None = None) -> None:
        import google.generativeai as genai

        self._model_name = model_name or DEFAULT_GEMINI_MODEL
        genai.configure(api_key=api_key)
        self._genai = genai
        self.model = genai.GenerativeModel(
            model_name=self._model_name,
            system_instruction=_GENERATION_SYSTEM,
        )

    def generate(self, prompt: str, theme: str) -> CampaignOutput:
        response = self.model.generate_content(
            f"Battle theme: {theme}\n\nParticipant prompt: {prompt}\n\n"
            "Produce the creative output now. Return JSON with keys: "
            'title, tagline, campaign_text.',
            generation_config={"max_output_tokens": 300, "temperature": 0.85},
        )
        text = response.text.strip()
        return _parse_campaign_json(text, theme=theme, prompt=prompt)

    def judge(self, output: str, theme: str) -> tuple[float, str]:
        judge_model = self._genai.GenerativeModel(self._model_name)
        result = judge_model.generate_content(
            "You are a strict creative battle judge.\n\n"
            f"Battle theme: {theme}\n\n"
            f"Submitted output:\n{output}\n\n"
            "Score 0-100 based on:\n"
            "- Relevance to theme (40%)\n"
            "- Creativity and originality (35%)\n"
            "- Conciseness and impact (25%)\n\n"
            'Respond ONLY in this exact JSON: {"score": <0-100>, '
            '"reason": "<one sentence>"}'
        )
        raw = result.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return float(data["score"]), str(data["reason"])


class MockProvider:
    """Used when GROQ_API_KEY is not set."""

    def generate(self, prompt: str, theme: str) -> CampaignOutput:
        time.sleep(2)
        hook = prompt.strip()[:50]
        theme_hook = theme.strip()[:40]
        return {
            "title": f"{theme_hook} Response",
            "tagline": f"Inspired by {hook}",
            "campaign_text": (
                f"A bold creative response to '{hook}' within the theme of "
                f"{theme_hook}. [Mock output — set GROQ_API_KEY for real generation]"
            ),
        }

    def judge(self, output: str, theme: str) -> tuple[float, str]:
        score = round(random.uniform(40, 92), 1)
        return score, (
            f"Mock evaluation: scored {score}/100 on theme relevance and creativity."
        )


def get_provider(*, app=None) -> AIProvider:
    if _groq_api_key(app=app):
        return GroqProvider(app=app)
    return MockProvider()


def _mock_campaign_output(prompt: str, theme: str, *, app=None) -> CampaignOutput:
    from flask import current_app, has_app_context
    from app.ai import get_ai_provider

    flask_app = app
    if flask_app is None and has_app_context():
        flask_app = current_app._get_current_object()
    return get_ai_provider(flask_app).generate_campaign(
        prompt_text=prompt,
        battle_theme=theme,
    )


def generate_with_fallback(
    prompt: str,
    theme: str,
    *,
    app=None,
) -> CampaignOutput:
    if not _groq_api_key(app=app):
        return _mock_campaign_output(prompt, theme, app=app)

    provider = get_provider(app=app)
    try:
        result = provider.generate(prompt, theme)
        logger.info("Groq generation succeeded")
        return result
    except Exception as exc:
        logger.warning("Groq generation failed (%s); using mock fallback", exc)
        return _mock_campaign_output(prompt, theme, app=app)


def judge_with_fallback(output: str, theme: str, *, app=None) -> tuple[float, str]:
    if not _groq_api_key(app=app):
        return MockProvider().judge(output, theme)

    provider = get_provider(app=app)
    try:
        return provider.judge(output, theme)
    except Exception as exc:
        logger.warning("Groq judge failed (%s); using heuristic score", exc)
        return MockProvider().judge(output, theme)
