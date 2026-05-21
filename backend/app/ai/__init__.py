from __future__ import annotations

from flask import Flask

from app.ai.base import BaseAIProvider
from app.ai.mock import MockAIProvider


def get_ai_provider(app: Flask | None = None) -> BaseAIProvider:
    """Factory for the configured AI provider (MVP: mock only)."""
    if app is not None:
        failure_rate = float(app.config.get("MOCK_AI_FAILURE_RATE", 0.12))
        min_lat = float(app.config.get("MOCK_AI_MIN_LATENCY", 2.0))
        max_lat = float(app.config.get("MOCK_AI_MAX_LATENCY", 6.0))
        return MockAIProvider(
            min_latency=min_lat,
            max_latency=max_lat,
            failure_rate=failure_rate,
        )
    return MockAIProvider()
