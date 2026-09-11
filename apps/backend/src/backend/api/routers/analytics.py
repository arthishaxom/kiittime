import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.analytics.reader import get_analytics_reader
from backend.api.schemas import (
    AnalyticsDashboard,
    DailyUsageItem,
    EndpointHealthItem,
    SectionTrendItem,
)
from backend.auth.dependencies import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("/dashboard", response_model=AnalyticsDashboard)
def get_dashboard(days: int = Query(30, ge=1, le=365)) -> AnalyticsDashboard:
    """Return one consistent snapshot from the PostgreSQL serving snapshot."""
    try:
        result = get_analytics_reader().dashboard(days)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Analytics temporarily unavailable") from exc
    return AnalyticsDashboard(
        usage=[
            DailyUsageItem(
                date=r.date,
                dau=r.dau,
                total_api_calls=r.total_api_calls,
                timetable_searches=r.timetable_searches,
            )
            for r in result.usage
        ],
        endpoint_health=[
            EndpointHealthItem(
                date=r.date,
                endpoint=r.endpoint,
                total_calls=r.total_calls,
                p95_latency_ms=r.p95_latency_ms,
                error_rate=r.error_rate,
            )
            for r in result.endpoint_health
        ],
        section_trends=[
            SectionTrendItem(
                date=r.date,
                section_name=r.section_name,
                section_year=r.section_year,
                search_volume=r.search_volume,
            )
            for r in result.section_trends
        ],
        data_as_of=result.data_as_of,
        synced_at=result.synced_at,
        stale=result.stale,
    )
