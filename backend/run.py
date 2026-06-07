"""Development entrypoint. Run from backend/ with the project venv:

    .venv\\Scripts\\python.exe run.py

Or use:  .\\start.ps1
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent
os.chdir(_BACKEND_ROOT)
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _require_dependencies() -> None:
    try:
        import flask_cors  # noqa: F401
    except ModuleNotFoundError:
        venv_python = _BACKEND_ROOT / ".venv" / "Scripts" / "python.exe"
        print(
            "Python dependencies are not installed for this interpreter.\n\n"
            f"  Current Python: {sys.executable}\n\n"
            "From the backend folder, run:\n"
            "  python -m venv .venv\n"
            "  .venv\\Scripts\\activate\n"
            "  pip install -r requirements.txt\n"
            "  copy .env.example .env\n"
            "  flask --app app:create_app init-db\n"
            f"  {venv_python} run.py\n",
            file=sys.stderr,
        )
        sys.exit(1)


_require_dependencies()

from app import create_app  # noqa: E402
from extensions import socketio  # noqa: E402

if os.getenv("SOCKETIO_ASYNC_MODE", "threading") == "eventlet":
    import eventlet

    eventlet.monkey_patch()

app = create_app()

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=app.debug,
        allow_unsafe_werkzeug=True,
    )
