from __future__ import annotations

import atexit
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

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


def submit_background(task: Callable[[], None]) -> None:
    get_executor().submit(task)
