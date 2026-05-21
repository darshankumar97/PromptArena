from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypedDict


class CampaignOutput(TypedDict):
    title: str
    tagline: str
    campaign_text: str


class BaseAIProvider(ABC):
    """Provider interface for prompt → campaign generation."""

    @abstractmethod
    def generate_campaign(
        self,
        *,
        prompt_text: str,
        battle_theme: str,
    ) -> CampaignOutput:
        """Blocking call; run inside a background worker thread."""
        raise NotImplementedError
