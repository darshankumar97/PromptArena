"""RQ-compatible background tasks (must be importable, no lambdas)."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def run_generation_job(job_id: int) -> None:
    from app import create_app
    from app.services.generation_service import GenerationService

    logger.info("generation job_id=%s worker=rq status=running (picked up)", job_id)
    app = create_app()
    with app.app_context():
        GenerationService._run_job_safe(app, job_id)
