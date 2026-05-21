from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

from flask import Flask
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.ai import get_ai_provider
from app.enums import JobStatus, JobType, SubmissionStatus
from app.errors import ConflictError, NotFoundError
from app.jobs.executor import submit_background
from app.models import GenerationJob, Round, Submission
from app.models.base import utcnow
from extensions import db

logger = logging.getLogger(__name__)

MAX_RETRIES = 1


class GenerationService:
    @staticmethod
    def enqueue_for_submission(submission_id: int, *, app: Flask) -> GenerationJob:
        """Create a queued job and schedule background processing (non-blocking)."""
        submission = db.session.scalar(
            select(Submission)
            .options(joinedload(Submission.round))
            .where(Submission.id == submission_id)
        )
        if submission is None:
            raise NotFoundError("Submission not found", code="SUBMISSION_NOT_FOUND")

        existing = db.session.scalar(
            select(GenerationJob).where(GenerationJob.submission_id == submission_id)
        )
        if existing is not None:
            raise ConflictError(
                "Generation job already exists for this submission",
                code="JOB_ALREADY_EXISTS",
            )

        job = GenerationJob(
            submission_id=submission.id,
            round_id=submission.round_id,
            job_type=JobType.GENERATE_SUBMISSION,
            status=JobStatus.QUEUED,
            retry_count=0,
        )
        submission.status = SubmissionStatus.PROCESSING
        db.session.add(job)
        db.session.flush()
        db.session.commit()

        room_id = submission.round.room_id
        payload = GenerationService._job_event_payload(job, submission)
        GenerationService._emit_job_queued(room_id, payload)
        GenerationService._notify_room_sync(room_id)

        app_obj = app
        job_id = job.id
        submit_background(lambda: GenerationService._run_job_safe(app_obj, job_id))

        return job

    @staticmethod
    def retry_job(job_id: int, *, app: Flask) -> GenerationJob:
        """Manual or automatic retry for a failed job (max one retry)."""
        job = db.session.get(GenerationJob, job_id)
        if job is None:
            raise NotFoundError("Job not found", code="JOB_NOT_FOUND")

        if job.status != JobStatus.FAILED:
            raise ConflictError("Only failed jobs can be retried", code="JOB_NOT_RETRYABLE")

        if job.retry_count >= MAX_RETRIES:
            raise ConflictError(
                "Maximum retries exceeded",
                code="MAX_RETRIES_EXCEEDED",
            )

        submission = db.session.get(Submission, job.submission_id)
        if submission is None:
            raise NotFoundError("Submission not found", code="SUBMISSION_NOT_FOUND")

        job.retry_count += 1
        job.status = JobStatus.QUEUED
        job.error_message = None
        job.started_at = None
        job.finished_at = None
        submission.status = SubmissionStatus.PROCESSING
        db.session.commit()

        room_id = GenerationService._room_id_for_job(job)
        payload = GenerationService._job_event_payload(job, submission)
        GenerationService._emit_job_queued(room_id, payload)
        GenerationService._notify_room_sync(room_id)

        app_obj = app
        submit_background(lambda: GenerationService._run_job_safe(app_obj, job_id))

        return job

    @staticmethod
    def _emit_job_queued(room_id: int, payload: dict) -> None:
        from app.socket_handlers.broadcast import emit_job_queued

        emit_job_queued(room_id, payload)

    @staticmethod
    def _emit_job_running(room_id: int, payload: dict) -> None:
        from app.socket_handlers.broadcast import emit_job_running

        emit_job_running(room_id, payload)

    @staticmethod
    def _emit_job_completed(room_id: int, payload: dict) -> None:
        from app.socket_handlers.broadcast import emit_job_completed

        emit_job_completed(room_id, payload)

    @staticmethod
    def _emit_job_failed(room_id: int, payload: dict) -> None:
        from app.socket_handlers.broadcast import emit_job_failed

        emit_job_failed(room_id, payload)

    @staticmethod
    def _notify_room_sync(room_id: int) -> None:
        from app.socket_handlers.broadcast import notify_room_sync

        notify_room_sync(room_id)

    @staticmethod
    def _run_job_safe(app: Flask, job_id: int) -> None:
        with app.app_context():
            try:
                GenerationService.run_job(job_id, app=app)
            except Exception:
                logger.exception("Unhandled error in generation job %s", job_id)
                db.session.rollback()

    @staticmethod
    def run_job(job_id: int, *, app: Flask) -> None:
        job = db.session.get(GenerationJob, job_id)
        if job is None:
            return

        if job.status not in (JobStatus.QUEUED,):
            return

        submission = db.session.scalar(
            select(Submission)
            .options(joinedload(Submission.round))
            .where(Submission.id == job.submission_id)
        )
        if submission is None:
            return

        room_id = submission.round.room_id
        round_ = submission.round

        job.status = JobStatus.RUNNING
        job.started_at = utcnow()
        job.error_message = None
        db.session.commit()

        GenerationService._emit_job_running(
            room_id, GenerationService._job_event_payload(job, submission)
        )
        GenerationService._notify_room_sync(room_id)

        provider = get_ai_provider(app)
        timeout_sec = int(app.config.get("GENERATION_JOB_TIMEOUT_SECONDS", 120))

        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(
                    provider.generate_campaign,
                    prompt_text=submission.prompt_text,
                    battle_theme=round_.battle_theme,
                )
                result = future.result(timeout=timeout_sec)
        except FuturesTimeout:
            GenerationService._handle_timeout(job, submission, room_id, app=app)
            return
        except Exception as exc:
            GenerationService._handle_failure(job, submission, room_id, str(exc), app=app)
            return

        submission.ai_output = json.dumps(result)
        submission.status = SubmissionStatus.COMPLETED
        job.status = JobStatus.COMPLETED
        job.finished_at = utcnow()
        job.error_message = None
        db.session.commit()

        GenerationService._emit_job_completed(
            room_id,
            {
                **GenerationService._job_event_payload(job, submission),
                "campaign": result,
            },
        )
        GenerationService._notify_room_sync(room_id)

    @staticmethod
    def _handle_timeout(
        job: GenerationJob,
        submission: Submission,
        room_id: int,
        *,
        app: Flask,
    ) -> None:
        job.status = JobStatus.TIMED_OUT
        job.error_message = "Generation timed out"
        job.finished_at = utcnow()
        submission.status = SubmissionStatus.FAILED
        db.session.commit()

        GenerationService._emit_job_failed(
            room_id,
            {
                **GenerationService._job_event_payload(job, submission),
                "error_message": job.error_message,
                "timed_out": True,
            },
        )
        GenerationService._notify_room_sync(room_id)

    @staticmethod
    def _handle_failure(
        job: GenerationJob,
        submission: Submission,
        room_id: int,
        message: str,
        *,
        app: Flask,
    ) -> None:
        if job.retry_count < MAX_RETRIES:
            job.retry_count += 1
            job.status = JobStatus.QUEUED
            job.error_message = None
            job.started_at = None
            job.finished_at = None
            submission.status = SubmissionStatus.PROCESSING
            db.session.commit()

            GenerationService._emit_job_queued(
                room_id, GenerationService._job_event_payload(job, submission)
            )
            GenerationService._notify_room_sync(room_id)

            job_id = job.id
            submit_background(lambda: GenerationService._run_job_safe(app, job_id))
            return

        job.status = JobStatus.FAILED
        job.error_message = message[:2000]
        job.finished_at = utcnow()
        submission.status = SubmissionStatus.FAILED
        db.session.commit()

        GenerationService._emit_job_failed(
            room_id,
            {
                **GenerationService._job_event_payload(job, submission),
                "error_message": job.error_message,
            },
        )
        GenerationService._notify_room_sync(room_id)

    @staticmethod
    def _room_id_for_job(job: GenerationJob) -> int:
        round_ = db.session.get(Round, job.round_id)
        if round_ is None:
            raise NotFoundError("Round not found", code="ROUND_NOT_FOUND")
        return round_.room_id

    @staticmethod
    def _job_event_payload(job: GenerationJob, submission: Submission) -> dict:
        return {
            "job_id": job.id,
            "submission_id": submission.id,
            "round_id": job.round_id,
            "user_id": submission.user_id,
            "status": job.status.value,
            "retry_count": job.retry_count,
        }
