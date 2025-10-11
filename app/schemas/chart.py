"""Pydantic schemas for chart resources."""
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class ChartMetadata(BaseModel):
    id: str
    name: str
    description: str
    updateInterval: Optional[int]
    lastUpdated: Optional[datetime]


class ChartPayload(BaseModel):
    metadata: ChartMetadata
    payload: Dict[str, Any]
