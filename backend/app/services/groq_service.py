from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"

FALLBACK_RESPONSE = (
    "A creative response could not be generated at this time. "
    "Please try again in a moment."
)


def _groq_api_key(*, app=None) -> str:
    if app is not None:
        return (app.config.get("GROQ_API_KEY") or "").strip()
    return (os.environ.get("GROQ_API_KEY") or "").strip()


def _groq_model_name(*, app=None) -> str:
    if app is not None:
        model = (app.config.get("GROQ_MODEL") or "").strip()
        if model:
            return model
    return (os.environ.get("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip()


def generate_ai_response(prompt: str, *, app=None) -> str:
    """Send user prompt to Groq chat completion API; return generated text only."""
    api_key = _groq_api_key(app=app)
    if not api_key:
        logger.warning("GROQ_API_KEY not set; using fallback response")
        return FALLBACK_RESPONSE

    try:
        from groq import Groq

        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=_groq_model_name(app=app),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.85,
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            logger.warning("Groq returned empty content; using fallback response")
            return FALLBACK_RESPONSE
        return text
    except Exception as exc:
        logger.warning("Groq generation failed (%s); using fallback response", exc)
        return FALLBACK_RESPONSE
