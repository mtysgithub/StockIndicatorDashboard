"""Chart plugins for S&P 500 close divided by the 100-period moving average."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING, Dict, Iterable, List

from app.charts.base import ChartPlugin

_TICKER = "^GSPC"
_START_DATE = "1950-01-01"


if TYPE_CHECKING:  # pragma: no cover - imported for type checking only
    import pandas as pd


async def _download_close_series() -> "pd.Series":
    """Download the S&P 500 daily close series asynchronously."""

    import pandas as pd
    import yfinance as yf

    dataframe = await asyncio.to_thread(
        yf.download,
        _TICKER,
        start=_START_DATE,
        interval="1d",
        progress=False,
    )
    if "Close" not in dataframe:
        raise ValueError("Failed to download close prices for S&P 500")
    close = dataframe["Close"].dropna()
    close.index = pd.to_datetime(close.index)
    return close


def _compute_ratio(
    series: "pd.Series", resample_rule: str, window: int
) -> "pd.Series":
    """Resample close prices and compute the close/MA ratio."""

    resampled = series.resample(resample_rule).last()
    moving_average = resampled.rolling(window=window).mean()
    ratio = (resampled / moving_average).dropna()
    return ratio


def _format_time_labels(series: "pd.Series", fmt: str) -> List[str]:
    return [index.strftime(fmt) for index in series.index]


def _constant_line(value: float, length: int) -> List[float]:
    return [value] * length


@dataclass
class _RatioConfig:
    resample_rule: str
    window: int
    label_format: str
    ratio_label: str
    ratio_color: str
    threshold_value: float
    threshold_label: str


class _BaseSP500RatioChart(ChartPlugin):
    """Common logic shared by the S&P 500 ratio charts."""

    config: _RatioConfig

    async def fetch_payload(self) -> Dict[str, Iterable]:
        close = await _download_close_series()
        ratio = _compute_ratio(close, self.config.resample_rule, self.config.window)
        labels = _format_time_labels(ratio, self.config.label_format)
        ratio_values = [round(value, 4) for value in ratio]

        datasets = [
            {
                "label": self.config.ratio_label,
                "data": ratio_values,
                "borderColor": self.config.ratio_color,
                "backgroundColor": "rgba(99, 102, 241, 0.25)",
                "tension": 0.25,
                "pointRadius": 0,
            },
            {
                "label": self.config.threshold_label,
                "data": _constant_line(self.config.threshold_value, len(ratio_values)),
                "borderColor": "#ef4444",
                "borderDash": [6, 6],
                "pointRadius": 0,
            },
            {
                "label": "Baseline (1.0)",
                "data": _constant_line(1.0, len(ratio_values)),
                "borderColor": "#94a3b8",
                "borderDash": [4, 4],
                "pointRadius": 0,
            },
        ]

        return {
            "type": "line",
            "labels": labels,
            "datasets": datasets,
        }


class SP500MonthlyMA100RatioChart(_BaseSP500RatioChart):
    """Ratio of the S&P 500 monthly close to its 100-month moving average."""

    id = "sp500-ma100-monthly"
    name = "S&P 500 vs 100-Month MA"
    description = "Monthly closing price divided by the 100-month moving average."
    update_interval = 6 * 60 * 60  # refresh every 6 hours

    config = _RatioConfig(
        resample_rule="ME",
        window=100,
        label_format="%Y-%m",
        ratio_label="Close / 100-Month MA",
        ratio_color="#2563eb",
        threshold_value=1.7,
        threshold_label="Threshold 1.7",
    )


class SP500WeeklyMA100RatioChart(_BaseSP500RatioChart):
    """Ratio of the S&P 500 weekly close to its 100-week moving average."""

    id = "sp500-ma100-weekly"
    name = "S&P 500 vs 100-Week MA"
    description = "Weekly closing price divided by the 100-week moving average."
    update_interval = 6 * 60 * 60

    config = _RatioConfig(
        resample_rule="W-FRI",
        window=100,
        label_format="%Y-%m-%d",
        ratio_label="Close / 100-Week MA",
        ratio_color="#16a34a",
        threshold_value=1.3,
        threshold_label="Threshold 1.3",
    )

