from __future__ import annotations

import random
import time

from app.ai.base import BaseAIProvider, CampaignOutput


_CAMPAIGN_TEMPLATES: list[CampaignOutput] = [
    {
        "title": "Chrome Tears",
        "tagline": "Beauty breaks where the city never sleeps.",
        "campaign_text": (
            "Opening on rain-slick chrome and a single tear caught in neon reflection. "
            "Voiceover: every skyline sells a dream — this one sells the ache behind it. "
            "Cut to dancers in mirrored alleys, fragments of faces doubling until identity blurs. "
            "Product never named; only felt — a pulse in the chest when the bass drops and the "
            "billboards flicker like eyelids. Close: your prompt rewritten as prophecy on glass."
        ),
    },
    {
        "title": "Neon Saints",
        "tagline": "Pray in color. Sin in silence.",
        "campaign_text": (
            "Cathedral of LED and fog. Pilgrims wear halos made of tube light. "
            "Each frame a stained-glass panel for a god that runs on electricity. "
            "Slow push through incense and synth; the host speaks in subtitles only the faithful read. "
            "Miracles are glitches — a hand heals, a street floods with magenta tide. "
            "End card: become luminous. The city already has your name in its ledger."
        ),
    },
    {
        "title": "Synthetic Desire",
        "tagline": "Want was manufactured. You were not.",
        "campaign_text": (
            "Laboratory romance: models that breathe, algorithms that blush. "
            "A love story told through UI micro-interactions and macro loneliness. "
            "Hands almost touch across a screen; the camera treats pixels like skin. "
            "Taglines dissolve into ASMR whispers about belonging and upgrade cycles. "
            "Final beat: desire outlives the product. The campaign is the longing itself."
        ),
    },
    {
        "title": "Velvet Static",
        "tagline": "Hear the silence advertise itself.",
        "campaign_text": (
            "Analog grain over digital perfection. A radio voice sells quiet at premium volume. "
            "Montage of empty rooms that feel crowded with intention. "
            "Your battle prompt becomes the jingle — repeated until it sounds like truth. "
            "Luxury is the gap between what you asked for and what you deserved."
        ),
    },
    {
        "title": "Midnight Orbit",
        "tagline": "We launch nothing. We land everywhere.",
        "campaign_text": (
            "Satellites of streetlamps; bodies in slow orbit around a club that might be a spaceship. "
            "Zero gravity confetti. Narrator insists this is not science fiction — it is Tuesday. "
            "Theme and prompt collide in a supercut of almost-memories. "
            "Fade to logo that was never shown, only implied."
        ),
    },
]


class MockAIProvider(BaseAIProvider):
    """Simulates an LLM with latency, occasional failure, and cinematic copy."""

    def __init__(
        self,
        *,
        min_latency: float = 2.0,
        max_latency: float = 6.0,
        failure_rate: float = 0.12,
    ) -> None:
        self.min_latency = min_latency
        self.max_latency = max_latency
        self.failure_rate = failure_rate

    def generate_campaign(
        self,
        *,
        prompt_text: str,
        battle_theme: str,
    ) -> CampaignOutput:
        delay = random.uniform(self.min_latency, self.max_latency)
        time.sleep(delay)

        if random.random() < self.failure_rate:
            raise RuntimeError("Mock provider: generation service temporarily unavailable")

        base = random.choice(_CAMPAIGN_TEMPLATES).copy()
        prompt_hook = prompt_text.strip()[:120]
        theme_hook = battle_theme.strip()[:80]

        base["tagline"] = f"{base['tagline']} [{theme_hook}]"
        base["campaign_text"] = (
            f"{base['campaign_text']}\n\n"
            f"— Inspired by: \"{prompt_hook}\""
        )
        return base
