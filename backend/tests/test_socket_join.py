"""Socket.IO authenticate + join_room flow."""

import pytest

from app import create_app
from config import TestingConfig
from extensions import db, socketio


@pytest.fixture
def app():
    application = create_app(TestingConfig)
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


def test_host_socket_join_receives_room_snapshot(app):
    client = app.test_client()
    r = client.post("/api/auth/register", json={"display_name": "Host"})
    assert r.status_code == 201
    token = r.get_json()["access_token"]

    r = client.post("/api/rooms", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201
    room = r.get_json()["room"]

    sio = socketio.test_client(app, flask_test_client=client)
    assert sio.is_connected()

    sio.emit("authenticate", {"access_token": token})
    auth_msgs = sio.get_received()
    assert any(m["name"] == "authenticated" for m in auth_msgs)

    sio.emit("join_room", {"room_code": room["code"]})
    join_msgs = sio.get_received()
    names = [m["name"] for m in join_msgs]
    assert "room_snapshot" in names, names
    snap = next(m["args"][0] for m in join_msgs if m["name"] == "room_snapshot")
    assert snap["room"]["code"] == room["code"]
