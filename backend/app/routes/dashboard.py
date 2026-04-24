import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..cache import get_cache
from ..config import get_settings
from ..kql.client import run_query
from ..kql.queries import (
    build_dashboard_summary_query,
    build_external_destinations_query,
    build_flow_timeline_query,
    build_fw_leaders_query,
    build_new_vms_query,
    build_threat_hits_query,
    build_top_denied_sources_query,
    build_top_talkers_query,
)

router = APIRouter(prefix="/dashboard")
logger = logging.getLogger(__name__)


# ── Response models ──────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    active_vms: int = 0
    total_bytes: int = 0
    denied_flows: int = 0
    # prior-period deltas (None when unavailable)
    active_vms_delta: int | None = None
    total_bytes_delta: int | None = None
    denied_flows_delta: int | None = None


class TopTalker(BaseModel):
    vm_name: str = ""
    environment: str = ""
    bytes_total: int = 0
    peer_count: int = 0
    flow_count: int = 0


class TopDeniedSource(BaseModel):
    src_ip: str = ""
    denied_count: int = 0
    top_dest: str = ""
    top_dest_vm: str = ""


class FWLeader(BaseModel):
    rule: str = ""
    action: str = ""
    policy: str = ""
    rule_type: str = ""
    hit_count: int = 0


class ExternalDestination(BaseModel):
    dest_ip: str = ""
    bytes_total: int = 0
    flow_count: int = 0


class NewVm(BaseModel):
    vm_name: str = ""
    first_seen: str = ""


class ThreatHit(BaseModel):
    ip: str = ""
    threat_type: str = ""
    threat_description: str = ""
    last_seen: str = ""
    hit_count: int = 0


class FlowTimelineBucket(BaseModel):
    bucket_start: str = ""
    inbound_bytes: int = 0
    outbound_bytes: int = 0
    denied_count: int = 0


class TopTalkersResponse(BaseModel):
    items: list[TopTalker]


class TopDeniedResponse(BaseModel):
    items: list[TopDeniedSource]


class FWLeadersResponse(BaseModel):
    items: list[FWLeader]


class ExternalDestinationsResponse(BaseModel):
    items: list[ExternalDestination]


class NewVmsResponse(BaseModel):
    items: list[NewVm]


class ThreatsResponse(BaseModel):
    items: list[ThreatHit]
    has_threats: bool = False


class TimelineResponse(BaseModel):
    items: list[FlowTimelineBucket]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _time_window(hours: int) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)
    return start, end


def _run_all_nta(settings, query: str, start: datetime, end: datetime) -> list[dict]:
    rows: list[dict] = []
    for ws_id in filter(None, [settings.law_prod_nta_id, settings.law_dev_nta_id]):
        rows.extend(run_query(ws_id, query, start, end))
    return rows


def _isostr(val: object) -> str:
    if hasattr(val, "isoformat"):
        return val.isoformat()  # type: ignore[union-attr]
    return str(val or "")


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(hours: int = Query(24, ge=1, le=720)) -> DashboardSummary:
    cache = get_cache("dashboard")
    key = f"summary:{hours}"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    start, end = _time_window(hours)
    rows = _run_all_nta(settings, build_dashboard_summary_query(start, end), start, end)

    current: dict = rows[0] if rows else {}

    # Prior period for deltas
    prior_start = start - timedelta(hours=hours)
    prior_rows = _run_all_nta(
        settings, build_dashboard_summary_query(prior_start, start), prior_start, start
    )
    prior: dict = prior_rows[0] if prior_rows else {}

    def delta(cur_key: str, pri_key: str) -> int | None:
        c = current.get(cur_key)
        p = prior.get(pri_key)
        if c is None or p is None:
            return None
        return int(c) - int(p)

    resp = DashboardSummary(
        active_vms=int(current.get("ActiveVms") or 0),
        total_bytes=int(current.get("TotalBytes") or 0),
        denied_flows=int(current.get("DeniedFlows") or 0),
        active_vms_delta=delta("ActiveVms", "ActiveVms"),
        total_bytes_delta=delta("TotalBytes", "TotalBytes"),
        denied_flows_delta=delta("DeniedFlows", "DeniedFlows"),
    )
    cache[key] = resp
    return resp


@router.get("/top-talkers", response_model=TopTalkersResponse)
async def dashboard_top_talkers(hours: int = Query(24, ge=1, le=720)) -> TopTalkersResponse:
    cache = get_cache("dashboard")
    key = f"top-talkers:{hours}"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    start, end = _time_window(hours)
    rows = _run_all_nta(settings, build_top_talkers_query(start, end), start, end)

    items = [
        TopTalker(
            vm_name=str(r.get("VmName") or ""),
            environment=str(r.get("Environment") or ""),
            bytes_total=int(r.get("BytesTotal") or 0),
            peer_count=int(r.get("PeerCount") or 0),
            flow_count=int(r.get("FlowCount") or 0),
        )
        for r in rows
    ]
    resp = TopTalkersResponse(items=items)
    cache[key] = resp
    return resp


@router.get("/top-denied", response_model=TopDeniedResponse)
async def dashboard_top_denied(hours: int = Query(24, ge=1, le=720)) -> TopDeniedResponse:
    cache = get_cache("dashboard")
    key = f"top-denied:{hours}"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    start, end = _time_window(hours)
    rows = _run_all_nta(settings, build_top_denied_sources_query(start, end), start, end)

    items = [
        TopDeniedSource(
            src_ip=str(r.get("SrcIp") or ""),
            denied_count=int(r.get("DeniedCount") or 0),
            top_dest=str(r.get("TopDest") or ""),
            top_dest_vm=str(r.get("TopDestVm") or ""),
        )
        for r in rows
    ]
    resp = TopDeniedResponse(items=items)
    cache[key] = resp
    return resp


@router.get("/fw-leaders", response_model=FWLeadersResponse)
async def dashboard_fw_leaders(hours: int = Query(24, ge=1, le=720)) -> FWLeadersResponse:
    cache = get_cache("dashboard")
    key = f"fw-leaders:{hours}"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    start, end = _time_window(hours)

    rows: list[dict] = []
    if settings.law_firewall_id:
        rows = run_query(
            settings.law_firewall_id,
            build_fw_leaders_query(start, end),
            start,
            end,
        )

    items = [
        FWLeader(
            rule=str(r.get("Rule") or ""),
            action=str(r.get("Action") or ""),
            policy=str(r.get("Policy") or ""),
            rule_type=str(r.get("RuleType") or ""),
            hit_count=int(r.get("HitCount") or 0),
        )
        for r in rows
    ]
    resp = FWLeadersResponse(items=items)
    cache[key] = resp
    return resp


@router.get("/external-destinations", response_model=ExternalDestinationsResponse)
async def dashboard_external_destinations(
    hours: int = Query(24, ge=1, le=720),
) -> ExternalDestinationsResponse:
    cache = get_cache("dashboard")
    key = f"external:{hours}"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    start, end = _time_window(hours)
    rows = _run_all_nta(settings, build_external_destinations_query(start, end), start, end)

    items = [
        ExternalDestination(
            dest_ip=str(r.get("DestIp") or ""),
            bytes_total=int(r.get("BytesTotal") or 0),
            flow_count=int(r.get("FlowCount") or 0),
        )
        for r in rows
    ]
    resp = ExternalDestinationsResponse(items=items)
    cache[key] = resp
    return resp


@router.get("/new-vms", response_model=NewVmsResponse)
async def dashboard_new_vms() -> NewVmsResponse:
    cache = get_cache("dashboard")
    key = "new-vms"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    rows = _run_all_nta(settings, build_new_vms_query(), start, end)

    items = [
        NewVm(
            vm_name=str(r.get("VmName") or ""),
            first_seen=_isostr(r.get("FirstSeen")),
        )
        for r in rows
    ]
    resp = NewVmsResponse(items=items)
    cache[key] = resp
    return resp


@router.get("/timeline", response_model=TimelineResponse)
async def dashboard_timeline(hours: int = Query(24, ge=1, le=720)) -> TimelineResponse:
    cache = get_cache("dashboard")
    key = f"timeline:{hours}"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    start, end = _time_window(hours)
    rows = _run_all_nta(settings, build_flow_timeline_query(start, end), start, end)

    items = [
        FlowTimelineBucket(
            bucket_start=_isostr(r.get("BucketStart")),
            inbound_bytes=int(r.get("InboundBytes") or 0),
            outbound_bytes=int(r.get("OutboundBytes") or 0),
            denied_count=int(r.get("DeniedCount") or 0),
        )
        for r in rows
    ]
    resp = TimelineResponse(items=items)
    cache[key] = resp
    return resp


@router.get("/threats", response_model=ThreatsResponse)
async def dashboard_threats(hours: int = Query(24, ge=1, le=720)) -> ThreatsResponse:
    cache = get_cache("dashboard")
    key = f"threats:{hours}"
    if key in cache:
        return cache[key]  # type: ignore[return-value]

    settings = get_settings()
    start, end = _time_window(hours)

    rows: list[dict] = []
    # NTAIpDetails is in the prod NTA workspace
    if settings.law_prod_nta_id:
        rows = run_query(settings.law_prod_nta_id, build_threat_hits_query(start, end), start, end)

    items = [
        ThreatHit(
            ip=str(r.get("Ip") or ""),
            threat_type=str(r.get("ThreatType") or ""),
            threat_description=str(r.get("ThreatDescription") or ""),
            last_seen=_isostr(r.get("LastSeen")),
            hit_count=int(r.get("HitCount") or 0),
        )
        for r in rows
    ]
    resp = ThreatsResponse(items=items, has_threats=len(items) > 0)
    cache[key] = resp
    return resp
