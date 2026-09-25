from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI

from app.config import get_settings
from app.services.etl_service import MarineETLService


logger = logging.getLogger(__name__)


def start_daily_scheduler(app: FastAPI) -> None:
    settings = get_settings()
    if not settings.scheduler_enabled:
        return
    if getattr(app.state, "marine_scheduler_task", None):
        return

    app.state.marine_scheduler_task = asyncio.create_task(_scheduler_loop(settings.scheduler_interval_hours))


async def stop_daily_scheduler(app: FastAPI) -> None:
    task = getattr(app.state, "marine_scheduler_task", None)
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    app.state.marine_scheduler_task = None


async def _scheduler_loop(interval_hours: int) -> None:
    interval_seconds = max(1, interval_hours) * 60 * 60
    while True:
        try:
            await MarineETLService().refresh()
        except Exception:
            logger.exception("Scheduled RAPID-AI ETL refresh failed")
        await asyncio.sleep(interval_seconds)
