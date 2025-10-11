"""Base classes and utilities for chart plugins."""
from __future__ import annotations

import abc
import datetime as dt
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class ChartState:
    """Runtime state for a chart instance."""

    last_updated: Optional[dt.datetime] = None
    payload: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


class ChartPlugin(abc.ABC):
    """Abstract base class that every chart plugin must inherit from."""

    id: str
    name: str
    description: str = ""
    update_interval: Optional[int] = None

    def __init__(self) -> None:
        self.state = ChartState()

    @abc.abstractmethod
    async def fetch_payload(self) -> Dict[str, Any]:
        """Collect chart payload.

        Implementations should return a JSON-serialisable dictionary that the
        frontend can use to render the chart. The structure is intentionally
        flexible to accommodate visualisation libraries such as Chart.js or Plotly.
        """

    async def update(self) -> None:
        """Refresh internal state and timestamp."""

        logger = logging.getLogger(__name__)
        try:
            payload = await self.fetch_payload()
        except Exception as exc:  # pragma: no cover - defensive branch
            logger.exception("Failed to update chart '%s'", self.id)
            message = str(exc)
            self.state.payload = {"type": "line", "labels": [], "datasets": [], "error": message}
            self.state.error = message
            return

        self.state.payload = payload
        self.state.last_updated = dt.datetime.now(dt.timezone.utc)
        self.state.error = None

    def to_dict(self) -> Dict[str, Any]:
        """Metadata exposed to the API layer."""

        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "updateInterval": self.update_interval,
            "lastUpdated": self.state.last_updated.isoformat() if self.state.last_updated else None,
        }
