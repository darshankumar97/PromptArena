from __future__ import annotations

from flask import current_app

from app.models import Submission
from app.services.generation_service import GenerationService


def schedule_generation_for_submission(submission: Submission):
    """Queue async AI generation after a prompt is persisted (non-blocking)."""
    app = current_app._get_current_object()
    return GenerationService.enqueue_for_submission(submission.id, app=app)
