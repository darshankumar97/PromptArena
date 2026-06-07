"""Production WSGI entry (Render: gunicorn --worker-class eventlet -w 1 wsgi:app)."""

import eventlet

eventlet.monkey_patch()

from app import create_app

app = create_app()
