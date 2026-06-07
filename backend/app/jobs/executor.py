from __future__ import annotations

import atexit
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from app.jobs.queue_config import RQ_QUEUE_NAME, should_use_rq_queue

logger = logging.getLogger(__name__)

_executor: ThreadPoolExecutor | None = None


def get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(
            max_workers=4,
            thread_name_prefix="promptarena-gen",
        )
        atexit.register(shutdown_executor)
    return _executor


def shutdown_executor() -> None:
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def enqueue_generation_job(job_id: int, *, app=None) -> None:
    """Schedule a generation job via RQ (production) or in-process thread pool (local dev)."""
    from flask import Flask, has_app_context, current_app

    from app.jobs.tasks import run_generation_job
    from app.services.generation_service import GenerationService
    from app.services.redis_client import get_redis

    flask_app: Flask | None = app
    if flask_app is None and has_app_context():
        flask_app = current_app._get_current_object()

    if flask_app is not None and flask_app.config.get("TESTING"):
        logger.info("generation job_id=%s enqueue backend=thread-pool (testing)", job_id)
        get_executor().submit(
            lambda: GenerationService._run_job_safe(flask_app, job_id)
        )
        return

    use_rq = should_use_rq_queue(flask_app)
    if use_rq:
        redis_client = get_redis()
        if redis_client is not None:
            try:
                from rq import Queue

                Queue(RQ_QUEUE_NAME, connection=redis_client).enqueue(
                    run_generation_job,
                    job_id,
                    job_timeout=600,
                )
                logger.info(
                    "generation job_id=%s enqueue backend=rq queue=%s",
                    job_id,
                    RQ_QUEUE_NAME,
                )
                return
            except Exception as exc:
                logger.warning(
                    "RQ enqueue failed for job_id=%s (%s); falling back to thread pool",
                    job_id,
                    exc,
                )

    logger.info("generation job_id=%s enqueue backend=thread-pool", job_id)
    if flask_app is None:
        get_executor().submit(run_generation_job, job_id)
    else:
        get_executor().submit(
            lambda: GenerationService._run_job_safe(flask_app, job_id)
        )


def submit_background(task: Callable[[], None]) -> None:
    get_executor().submit(task)
