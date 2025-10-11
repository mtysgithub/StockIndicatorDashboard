"""Runtime registry and scheduler for chart plugins."""
from __future__ import annotations

import asyncio
import importlib
import pkgutil
from typing import Dict, Iterable, List, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.charts.base import ChartPlugin
from app.config import get_settings


class ChartManager:
    """Manage discovery, storage, and scheduling of chart plugins."""

    def __init__(self) -> None:
        self._charts: Dict[str, ChartPlugin] = {}
        self._scheduler = AsyncIOScheduler(timezone=get_settings().update_timezone)

    def discover(self, package: str = "app.charts") -> None:
        """Auto-discover chart plugins within a package."""

        module = importlib.import_module(package)
        for info in pkgutil.walk_packages(module.__path__, module.__name__ + "."):
            if info.name.endswith(".base"):
                continue
            imported = importlib.import_module(info.name)
            for attr in dir(imported):
                obj = getattr(imported, attr)
                if not (isinstance(obj, type) and issubclass(obj, ChartPlugin)):
                    continue
                if obj is ChartPlugin:
                    continue
                if not getattr(obj, "id", None):
                    continue
                self.register(obj())

    def register(self, plugin: ChartPlugin) -> None:
        """Register a plugin instance and schedule its updates."""

        if plugin.id in self._charts:
            raise ValueError(f"Duplicate chart id detected: {plugin.id}")
        self._charts[plugin.id] = plugin
        interval = plugin.update_interval or get_settings().default_update_interval
        self._scheduler.add_job(
            self._wrap_update(plugin.id),
            trigger=IntervalTrigger(seconds=interval),
            id=f"update-{plugin.id}",
            replace_existing=True,
        )

    def _wrap_update(self, chart_id: str):
        async def _update() -> None:
            await self._charts[chart_id].update()

        return _update

    async def startup(self) -> None:
        """Start scheduler and perform initial warm-up."""

        await asyncio.gather(*(chart.update() for chart in self._charts.values()))
        if not self._scheduler.running:
            self._scheduler.start()

    async def shutdown(self) -> None:
        """Stop scheduler gracefully."""

        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    def list(self) -> Iterable[ChartPlugin]:
        return self._charts.values()

    def get(self, chart_id: str) -> Optional[ChartPlugin]:
        return self._charts.get(chart_id)

    async def trigger_update(self, chart_id: str) -> None:
        chart = self.get(chart_id)
        if not chart:
            raise KeyError(chart_id)
        await chart.update()


manager = ChartManager()
