"""REST API endpoints for chart management."""
from fastapi import APIRouter, HTTPException

from app.core.chart_manager import manager
from app.schemas.chart import ChartMetadata, ChartPayload

router = APIRouter(prefix="/api/charts", tags=["charts"])


@router.get("/", response_model=list[ChartMetadata])
async def list_charts() -> list[ChartMetadata]:
    return [ChartMetadata(**chart.to_dict()) for chart in manager.list()]


@router.get("/{chart_id}", response_model=ChartPayload)
async def get_chart(chart_id: str) -> ChartPayload:
    chart = manager.get(chart_id)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    return ChartPayload(metadata=ChartMetadata(**chart.to_dict()), payload=chart.state.payload)


@router.post("/{chart_id}/trigger", response_model=ChartPayload)
async def trigger_chart_update(chart_id: str) -> ChartPayload:
    chart = manager.get(chart_id)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    await manager.trigger_update(chart_id)
    return ChartPayload(metadata=ChartMetadata(**chart.to_dict()), payload=chart.state.payload)
