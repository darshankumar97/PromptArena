"""Reconnect / session restoration for existing room members."""

import time

import pytest

from app import create_app
from app.models import GenerationJob
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


def test_existing_member_rejoin_during_resolving(client):
    host_token, _ = _register(client, "Host")
    guest_token, _ = _register(client, "Guest")
    outsider_token, _ = _register(client, "Outsider")
    h = {"Authorization": f"Bearer {host_token}"}
    g = {"Authorization": f"Bearer {guest_token}"}
    o = {"Authorization": f"Bearer {outsider_token}"}

    r = client.post("/api/rooms", headers=h)
    assert r.status_code == 201
    room_id = r.get_json()["room"]["id"]

    r = client.post(f"/api/rooms/id/{room_id}/join", headers=g)
    assert r.status_code == 200
    assert r.get_json().get("reconnected") is False

    r = client.post(
        f"/api/rooms/id/{room_id}/round/start",
        headers=h,
        json={"battle_theme": "Test theme"},
    )
    assert r.status_code == 201
    round_id = r.get_json()["round"]["id"]

    r = client.post(
        f"/api/rooms/id/{room_id}/round/{round_id}/submit",
        headers=g,
        json={"prompt_text": "Guest campaign"},
    )
    assert r.status_code == 201

    r = client.post(f"/api/rooms/id/{room_id}/round/{round_id}/lock", headers=h)
    assert r.status_code == 200

    r = client.post(f"/api/rooms/id/{room_id}/join", headers=h)
    assert r.status_code == 200
    body = r.get_json()
    assert body.get("reconnected") is True
    assert body["snapshot"]["room"]["status"] == "resolving"

    r = client.post(f"/api/rooms/id/{room_id}/join", headers=g)
    assert r.status_code == 200
    assert r.get_json().get("reconnected") is True

    r = client.post(f"/api/rooms/id/{room_id}/join", headers=o)
    assert r.status_code == 409
    assert r.get_json()["error"]["code"] == "ROOM_NOT_JOINABLE"


def test_existing_member_rejoin_during_results(client, app):
    host_token, _ = _register(client, "Host")
    guest_token, guest_id = _register(client, "Guest")
    h = {"Authorization": f"Bearer {host_token}"}
    g = {"Authorization": f"Bearer {guest_token}"}

    r = client.post("/api/rooms", headers=h)
    room_id = r.get_json()["room"]["id"]
    client.post(f"/api/rooms/id/{room_id}/join", headers=g)

    r = client.post(
        f"/api/rooms/id/{room_id}/round/start",
        headers=h,
        json={"battle_theme": "Results phase"},
    )
    round_id = r.get_json()["round"]["id"]

    r = client.post(
        f"/api/rooms/id/{room_id}/round/{round_id}/submit",
        headers=g,
        json={"prompt_text": "Winner prompt"},
    )
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

    client.post(f"/api/rooms/id/{room_id}/round/{round_id}/lock", headers=h)
    r = client.post(
        f"/api/rooms/id/{room_id}/submissions/{sub_id}/score",
        headers=h,
        json={"score": 8},
    )
    assert r.status_code == 200
    r = client.post(
        f"/api/rooms/id/{room_id}/round/{round_id}/winner",
        headers=h,
        json={"submission_id": sub_id},
    )
    assert r.status_code == 200

    r = client.post(f"/api/rooms/id/{room_id}/join", headers=g)
    assert r.status_code == 200
    snap = r.get_json()["snapshot"]
    assert snap["room"]["status"] == "results"
    assert snap["current_round"]["winner_user_id"] == guest_id
