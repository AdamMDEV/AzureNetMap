import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from ..cache import cache_stats
from ..config import get_settings
from ..kql.client import run_query

router = APIRouter()
logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    law_reachable: bool
    cache_stats: dict


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    workspace_id = settings.law_prod_nta_id or settings.law_firewall_id
    law_reachable = _check_law(workspace_id)
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        law_reachable=law_reachable,
        cache_stats=cache_stats(),
    )


def _check_law(workspace_id: str) -> bool:
    if not workspace_id:
        return False
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=5)
    rows = run_query(workspace_id, 'print "ok"', start, end, max_retries=0)
    return len(rows) > 0
