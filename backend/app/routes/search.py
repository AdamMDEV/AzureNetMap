import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..cache import get_cache
from ..config import get_settings
from ..kql.client import run_query
from ..kql.queries import build_search_query

router = APIRouter()
logger = logging.getLogger(__name__)


class SearchEntry(BaseModel):
    vm_name: str = ""
    ip: str = ""
    subnet: str = ""
    vnet: str = ""


class SearchResponse(BaseModel):
    results: list[SearchEntry]


@router.get("/search", response_model=SearchResponse)
async def search(q: str = Query(..., min_length=1, max_length=128)) -> SearchResponse:
    cache = get_cache("search")
    cache_key = f"search:{q.lower().strip()}"
    if cache_key in cache:
        return cache[cache_key]  # type: ignore[return-value]

    settings = get_settings()
    workspace_id = settings.law_prod_nta_id or settings.law_dev_nta_id
    if not workspace_id:
        return SearchResponse(results=[])

    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=24)
    rows = run_query(workspace_id, build_search_query(q), start, end)

    results = [
        SearchEntry(
            vm_name=str(r.get("VmName") or ""),
            ip=str(r.get("Ip") or ""),
            subnet=str(r.get("Subnet") or ""),
            vnet=str(r.get("Vnet") or ""),
        )
        for r in rows
    ]
    resp = SearchResponse(results=results)
    cache[cache_key] = resp
    return resp
