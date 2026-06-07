"""Standalone RQ worker for generation jobs. Requires REDIS_URL and USE_RQ_QUEUE=1."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent
os.chdir(_BACKEND_ROOT)
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(_BACKEND_ROOT / ".env")
os.environ.setdefault("USE_RQ_QUEUE", "1")

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    url = os.environ.get("REDIS_URL", "").strip()
    if not url:
        print("REDIS_URL is required for worker_process.py", file=sys.stderr)
        sys.exit(1)

    from redis import Redis
    from rq import Queue, Worker

    from app import create_app
    from app.jobs.queue_config import RQ_QUEUE_NAME

    app = create_app()
    redis_conn = Redis.from_url(url)

    with app.app_context():
        queue = Queue(RQ_QUEUE_NAME, connection=redis_conn)
        logger.info(
            "RQ worker starting queue=%s pending_jobs=%s redis=%s",
            RQ_QUEUE_NAME,
            len(queue),
            url.split("@")[-1] if "@" in url else "local",
        )
        worker = Worker([queue], connection=redis_conn)
        worker.work()


if __name__ == "__main__":
    main()
