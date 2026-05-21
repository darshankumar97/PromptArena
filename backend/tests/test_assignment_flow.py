"""Core assignment flow tests (run: python -m pytest tests/ -v from backend/)."""

import time

import pytest

from app import create_app
from app.models import GenerationJob, Submission
from config import TestingConfig
from extensions import db


@pytest.fixture
def app():
    application = create_app(TestingConfig)
    application.config.update(
        {
            "MOCK_AI_MIN_LATENCY": 0.05,
            "MOCK_AI_MAX_LATENCY": 0.15,
            "MOCK_AI_FAILURE_RATE": 0.0,
        }
    )
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def _register(client, name: str) -> tuple[str, int]:
    r = client.post("/api/auth/register", json={"display_name": name})
    assert r.status_code == 201
    data = r.get_json()
    return data["access_token"], data["user"]["id"]


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"


def test_full_battle_round(client, app):
    host_token, host_id = _register(client, "Host")
    guest_token, guest_id = _register(client, "Guest")
    h = {"Authorization": f"Bearer {host_token}"}
    g = {"Authorization": f"Bearer {guest_token}"}

    r = client.post("/api/rooms", headers=h)
    assert r.status_code == 201
    room_id = r.get_json()["room"]["id"]

    r = client.post(f"/api/rooms/id/{room_id}/join", headers=g)
    assert r.status_code == 200

    r = client.post(
        f"/api/rooms/id/{room_id}/round/start",
        headers=h,
        json={"battle_theme": "Luxury cyberpunk perfume"},
    )
    assert r.status_code == 201
    round_id = r.get_json()["round"]["id"]

    r = client.post(
        f"/api/rooms/id/{room_id}/round/{round_id}/submit",
        headers=h,
        json={"prompt_text": "host tries"},
    )
    assert r.status_code == 403
    assert r.get_json()["error"]["code"] == "HOST_CANNOT_SUBMIT"

    r = client.post(
        f"/api/rooms/id/{room_id}/round/{round_id}/submit",
        headers=g,
        json={"prompt_text": "Neon saints campaign"},
    )
    assert r.status_code == 201
    sub_id = r.get_json()["submission"]["id"]
    job_id = r.get_json()["generation_job"]["id"]

    for _ in range(40):
        with app.app_context():
            job = db.session.get(GenerationJob, job_id)
            if job and job.status.value == "completed":
                break
        time.sleep(0.1)
    else:
        pytest.fail("generation did not complete")

    r = client.post(f"/api/rooms/id/{room_id}/round/{round_id}/lock", headers=h)
    assert r.status_code == 200

    r = client.post(
        f"/api/rooms/id/{room_id}/submissions/{sub_id}/score",
        headers=h,
        json={"score": 9},
    )
    assert r.status_code == 200

    r = client.post(
        f"/api/rooms/id/{room_id}/round/{round_id}/winner",
        headers=h,
        json={"submission_id": sub_id},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["round"]["winner_user_id"] == guest_id
    assert body["snapshot"]["room"]["status"] == "results"

    r = client.get(f"/api/rooms/id/{room_id}/snapshot", headers=g)
    assert r.status_code == 200
    snap = r.get_json()["snapshot"]
    assert snap["current_round"]["winner_user_id"] == guest_id

    with app.app_context():
        sub = db.session.get(Submission, sub_id)
        assert sub.score == 9.0
        assert sub.ai_output
