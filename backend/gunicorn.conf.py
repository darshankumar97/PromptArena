"""Gunicorn settings for Render + Flask-SocketIO.

Socket.IO WebSockets require the eventlet worker (requires gunicorn<26; the
eventlet worker was removed in Gunicorn 26). The default sync worker only
handles HTTP; Engine.IO may upgrade to WebSocket (HTTP 101) but application
events (authenticate, join_room, room_snapshot) will not be delivered reliably.
"""

from __future__ import annotations

import os

bind = f"0.0.0.0:{os.getenv('PORT', '10000')}"
worker_class = "eventlet"
workers = 1
worker_connections = 1000
timeout = 120
keepalive = 5
accesslog = "-"
errorlog = "-"
loglevel = "info"


def post_worker_init(worker) -> None:
    worker.log.info(
        "Gunicorn worker ready: class=%s (Socket.IO requires eventlet, not sync)",
        worker.__class__.__name__,
    )
