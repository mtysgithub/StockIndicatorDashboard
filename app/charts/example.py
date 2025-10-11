"""Example chart plugin demonstrating the extension API."""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from app.charts.base import ChartPlugin


class SampleMomentumChart(ChartPlugin):
    """Generate synthetic momentum data for demonstration purposes."""

    id = "sample-momentum"
    name = "Sample Momentum"
    description = "Synthetic data showcasing how to implement a chart plugin."
    update_interval = 120

    async def fetch_payload(self) -> Dict[str, List]:
        now = datetime.now(timezone.utc)
        labels = [
            (now - timedelta(minutes=5 * i)).strftime("%H:%M") for i in reversed(range(12))
        ]
        base = random.uniform(-1, 1)
        dataset = [round(base + random.uniform(-0.5, 0.5), 2) for _ in labels]
        return {
            "type": "line",
            "labels": labels,
            "datasets": [
                {
                    "label": "Momentum (synthetic)",
                    "data": dataset,
                    "borderColor": "#6366f1",
                    "backgroundColor": "rgba(99, 102, 241, 0.3)",
                    "tension": 0.35,
                }
            ],
        }
