"""Chart plugin namespace with lazy imports.

The dashboard performs plugin discovery dynamically, therefore chart
modules do not need to be imported eagerly.  By exposing the chart
classes lazily we avoid importing heavy optional dependencies (for
example :mod:`pandas`) before they are actually required.
"""

from __future__ import annotations

import importlib
from typing import Any

__all__ = [
    "SP500MonthlyMA100RatioChart",
    "SP500WeeklyMA100RatioChart",
]


def __getattr__(name: str) -> Any:  # pragma: no cover - simple delegation
    """Lazily resolve chart classes defined in submodules."""

    if name in __all__:
        module = importlib.import_module("app.charts.sp500_ma100")
        return getattr(module, name)
    raise AttributeError(f"module 'app.charts' has no attribute {name!r}")


def __dir__() -> list[str]:  # pragma: no cover - mirrors __all__
    return sorted(list(globals().keys()) + __all__)
