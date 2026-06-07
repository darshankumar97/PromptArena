# eventlet monkey_patch MUST be the first import side-effect (before Flask/SQLAlchemy).
import eventlet

eventlet.monkey_patch()

from app import create_app
from extensions import socketio

app = create_app()

# Visible in Render logs — confirms Flask-SocketIO matches the Gunicorn worker.
app.logger.info(
    "WSGI loaded: Flask-SocketIO async_mode=%s (Gunicorn must use --worker-class eventlet)",
    socketio.async_mode,
)
