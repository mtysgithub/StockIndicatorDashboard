# Stock Indicator Dashboard

Modern FastAPI-powered dashboard scaffold for scheduling and visualising US stock indicators.

## Features

- ⚡️ **Plugin architecture** – drop new Python chart plugins in `app/charts` and the manager will auto-discover them.
- ⏱️ **Configurable refresh** – each chart defines its own `update_interval` and the APScheduler background runner keeps them fresh.
- 🖥️ **Forward-looking UI** – dark, glassmorphism-inspired layout rendered with Chart.js and ready for expansion.
- 🌐 **API-first** – REST endpoints expose chart metadata and payloads for integration or bespoke clients.

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Navigate to http://127.0.0.1:8000 to access the dashboard.

## Adding your own chart plugin

1. Create a new module inside `app/charts`, e.g. `app/charts/my_indicator.py`.
2. Subclass `ChartPlugin` and implement `fetch_payload`.

```python
from __future__ import annotations

from app.charts.base import ChartPlugin


class MyFirstChart(ChartPlugin):
    id = "my-first-chart"
    name = "My first chart"
    description = "Shows how simple extending the dashboard can be."
    update_interval = 60  # seconds

    async def fetch_payload(self) -> dict:
        data = ...  # Use yfinance, pandas, etc.
        return {
            "type": "line",
            "labels": data.index.strftime("%Y-%m-%d").tolist(),
            "datasets": [
                {
                    "label": "Close",
                    "data": data["Close"].tolist(),
                    "borderColor": "#22d3ee",
                    "backgroundColor": "rgba(34, 211, 238, 0.25)",
                }
            ],
        }
```

3. The manager auto-discovers new plugins on startup. Restart the server (or let your deployment pipeline rebuild) and the chart appears in the UI.

## Configuration

Environment variables prefixed with `SID_` modify behaviour:

| Variable | Default | Description |
| --- | --- | --- |
| `SID_APP_NAME` | `"Stock Indicator Dashboard"` | Title used in the UI header. |
| `SID_UPDATE_TIMEZONE` | `UTC` | Timezone used by the scheduler. |
| `SID_DEFAULT_UPDATE_INTERVAL` | `300` | Fallback update cadence (seconds) when a plugin omits `update_interval`. |

## Project layout

```
app/
├── api/                 # REST routes
├── charts/              # Chart plugins (auto-discovered)
├── core/chart_manager.py# Scheduler + registry
├── main.py              # FastAPI application bootstrap
└── schemas/             # Shared response models
assets/                  # Front-end JavaScript/CSS
templates/               # Jinja templates rendered by FastAPI
```

## Deployment notes

- The web bundle is fully static and works on Vercel via ASGI using [`uvicorn`](https://www.uvicorn.org/) or any FastAPI-friendly adapter.
- Ensure `apscheduler` is allowed to run background tasks in your hosting environment; for serverless environments consider the `AsyncIOScheduler` with persistent storage.
- External data dependencies such as `yfinance` can be added to `requirements.txt` as you build real indicators.

## Roadmap ideas

- Persist chart payloads to Redis or Postgres for historical comparison.
- Add authentication for multi-tenant dashboards.
- Integrate WebSockets to push updates instantly to connected clients.
