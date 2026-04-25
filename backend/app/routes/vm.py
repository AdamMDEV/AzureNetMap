import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..cache import get_cache
from ..config import get_settings
from ..kql.client import run_query
from ..kql.queries import (
    build_firewall_query,
    build_vm_detail_query,
    build_vm_port_heatmap_query,
    build_vm_timeline_query,
    build_vm_top_peers_query,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class FlowRecord(BaseModel):
    time_generated: str = ""
    direction: str = ""
    src_ip: str = ""
    dest_ip: str = ""
    src_vm: str = ""
    dest_vm: str = ""
    dest_port: Any = None
    protocol: str = ""
    flow_type: str = ""
    flow_status: str = ""
    acl_rule: str = ""
    bytes_src_to_dest: int = 0
    bytes_dest_to_src: int = 0


class VMInfo(BaseModel):
    name: str
    display_name: str = ""
    ip: str = ""
    subnet: str = ""
    vnet: str = ""


class FirewallHit(BaseModel):
    source_ip: str = ""
    destination_ip: str = ""
    destination_port: Any = None
    protocol: str = ""
    rule_type: str = ""
    hit_count: int = 0
    rules: list[str] = []
    actions: list[str] = []
    policies: list[str] = []


class TimelineBucket(BaseModel):
    bucket_start: str = ""
    inbound_bytes: int = 0
    outbound_bytes: int = 0
    inbound_packets: int = 0
    outbound_packets: int = 0


class PeerEntry(BaseModel):
    peer_ip: str = ""
    peer_vm: str = ""
    bytes_total: int = 0
    flow_count: int = 0
    is_inbound: bool = False
    is_outbound: bool = False


class HeatmapEntry(BaseModel):
    hour_of_day: int = 0
    port: str = ""
    flow_count: int = 0


class DenySummary(BaseModel):
    count: int = 0
    top_rules: list[str] = []
    top_denied_peers: list[str] = []


class VMDetailResponse(BaseModel):
    vm: VMInfo
    inbound: list[FlowRecord]
    outbound: list[FlowRecord]
    firewall_hits: list[FirewallHit]
    timeline: list[TimelineBucket] = []
    top_peers: list[PeerEntry] = []
    port_heatmap: list[HeatmapEntry] = []
    deny_summary: DenySummary = DenySummary()


def _to_list(val: Any) -> list[str]:
    """Safely convert a KQL make_set result to list[str]. Handles string-encoded JSON arrays."""
    if isinstance(val, list):
        return [str(x) for x in val]
    if isinstance(val, str):
        val = val.strip()
        if val.startswith("["):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return [str(x) for x in parsed]
            except (json.JSONDecodeError, ValueError):
                pass
        return [val] if val else []
    return []


def _resolve_vm_name(raw: str) -> tuple[str, str]:
    """Return (display_name, kql_name). Strips path prefix if present."""
    display = raw
    resolved = raw.split("/")[-1] if "/" in raw else raw
    if resolved != raw:
        logger.debug("vm_name path prefix stripped: %r -> %r", raw, resolved)
    return display, resolved


def _parse_flows(
    rows: list[dict], vm_name: str
) -> tuple[list[FlowRecord], list[FlowRecord], set[str]]:
    inbound: list[FlowRecord] = []
    outbound: list[FlowRecord] = []
    all_ips: set[str] = set()

    for r in rows:
        tg = r.get("TimeGenerated")
        time_str = tg.isoformat() if hasattr(tg, "isoformat") else str(tg or "")
        flow = FlowRecord(
            time_generated=time_str,
            direction=str(r.get("Direction") or ""),
            src_ip=str(r.get("SrcIp") or ""),
            dest_ip=str(r.get("DestIp") or ""),
            src_vm=str(r.get("SrcVm") or ""),
            dest_vm=str(r.get("DestVm") or ""),
            dest_port=r.get("DestPort"),
            protocol=str(r.get("L4Protocol") or ""),
            flow_type=str(r.get("FlowStatus") or ""),
            flow_status=str(r.get("FlowType") or ""),
            acl_rule=str(r.get("AclRule") or ""),
            bytes_src_to_dest=int(r.get("BytesSrcToDest") or 0),
            bytes_dest_to_src=int(r.get("BytesDestToSrc") or 0),
        )
        if flow.src_ip:
            all_ips.add(flow.src_ip)
        if flow.dest_ip:
            all_ips.add(flow.dest_ip)
        if flow.direction == "Inbound":
            inbound.append(flow)
        else:
            outbound.append(flow)

    return inbound, outbound, all_ips


def _parse_timeline(rows: list[dict]) -> list[TimelineBucket]:
    result: list[TimelineBucket] = []
    for r in rows:
        bs = r.get("BucketStart")
        bucket_start = bs.isoformat() if hasattr(bs, "isoformat") else str(bs or "")
        result.append(TimelineBucket(
            bucket_start=bucket_start,
            inbound_bytes=int(r.get("InboundBytes") or 0),
            outbound_bytes=int(r.get("OutboundBytes") or 0),
            inbound_packets=int(r.get("InboundPackets") or 0),
            outbound_packets=int(r.get("OutboundPackets") or 0),
        ))
    return result


def _parse_top_peers(rows: list[dict]) -> list[PeerEntry]:
    result: list[PeerEntry] = []
    for r in rows:
        result.append(PeerEntry(
            peer_ip=str(r.get("PeerIp") or ""),
            peer_vm=str(r.get("PeerVm") or ""),
            bytes_total=int(r.get("BytesTotal") or 0),
            flow_count=int(r.get("FlowCount") or 0),
            is_inbound=bool(r.get("HasInbound")),
            is_outbound=bool(r.get("HasOutbound")),
        ))
    return result


def _parse_port_heatmap(rows: list[dict]) -> list[HeatmapEntry]:
    result: list[HeatmapEntry] = []
    for r in rows:
        result.append(HeatmapEntry(
            hour_of_day=int(r.get("HourOfDay") or 0),
            port=str(r.get("Port") or ""),
            flow_count=int(r.get("FlowCount") or 0),
        ))
    return result


def _build_deny_summary(inbound: list[FlowRecord], outbound: list[FlowRecord]) -> DenySummary:
    all_flows = inbound + outbound
    denied = [f for f in all_flows if f.flow_type == "Denied"]
    if not denied:
        return DenySummary()
    rules: dict[str, int] = {}
    peers: dict[str, int] = {}
    for f in denied:
        if f.acl_rule:
            rules[f.acl_rule] = rules.get(f.acl_rule, 0) + 1
        peer = f.src_ip if f.direction == "Inbound" else f.dest_ip
        if peer:
            peers[peer] = peers.get(peer, 0) + 1
    top_rules = sorted(rules, key=lambda k: rules[k], reverse=True)[:5]
    top_peers = sorted(peers, key=lambda k: peers[k], reverse=True)[:5]
    return DenySummary(count=len(denied), top_rules=top_rules, top_denied_peers=top_peers)


@router.get("/vm/{vm_name:path}", response_model=VMDetailResponse)
async def vm_detail(
    vm_name: str,
    hours: int = Query(24, ge=1, le=720),
) -> VMDetailResponse:
    display_name, resolved_name = _resolve_vm_name(vm_name)
    logger.info("vm_detail: raw=%r resolved=%r hours=%d", vm_name, resolved_name, hours)

    cache = get_cache("vm")
    cache_key = f"vm:{resolved_name.lower()}:{hours}"
    if cache_key in cache:
        return cache[cache_key]  # type: ignore[return-value]

    settings = get_settings()
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)

    query = build_vm_detail_query(resolved_name, start, end)
    all_rows: list[dict] = []
    for ws_id in filter(None, [settings.law_prod_nta_id, settings.law_dev_nta_id]):
        all_rows.extend(run_query(ws_id, query, start, end))

    # Fallback: contains search if exact match returned nothing
    use_contains = False
    if not all_rows:
        logger.info("vm_detail: exact match empty for %r, trying contains fallback", resolved_name)
        from ..kql.queries import _safe_vm_name, _iso
        safe = _safe_vm_name(resolved_name)
        fallback_query = f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where SrcVm contains "{safe}" or DestVm contains "{safe}"
| extend Direction = iff(SrcVm contains "{safe}", "Outbound", "Inbound")
| project TimeGenerated, Direction, SrcIp, DestIp, SrcVm, DestVm,
          DestPort, L4Protocol, FlowType, FlowStatus, AclRule,
          BytesSrcToDest, BytesDestToSrc, PacketsSrcToDest, PacketsDestToSrc,
          SrcSubnet, DestSubnet
| order by TimeGenerated desc
| take 1000"""
        for ws_id in filter(None, [settings.law_prod_nta_id, settings.law_dev_nta_id]):
            all_rows.extend(run_query(ws_id, fallback_query, start, end))
        if all_rows:
            logger.info("vm_detail: contains fallback found %d rows for %r", len(all_rows), resolved_name)
            use_contains = True

    inbound, outbound, all_ips = _parse_flows(all_rows, resolved_name)

    vm_ip, vm_subnet = "", ""
    if all_rows:
        first = all_rows[0]
        is_src = str(first.get("SrcVm") or "").lower() == resolved_name.lower()
        vm_ip = str(first.get("SrcIp" if is_src else "DestIp") or "")
        vm_subnet = str(first.get("SrcSubnet" if is_src else "DestSubnet") or "")

    firewall_hits: list[FirewallHit] = []
    if all_ips and settings.law_firewall_id:
        ip_list = list(all_ips)[:50]
        fw_rows = run_query(
            settings.law_firewall_id,
            build_firewall_query(ip_list, ip_list, start, end),
            start,
            end,
        )
        firewall_hits = [
            FirewallHit(
                source_ip=str(r.get("SourceIp") or ""),
                destination_ip=str(r.get("DestinationIp") or ""),
                destination_port=r.get("DestinationPort"),
                protocol=str(r.get("Protocol") or ""),
                rule_type=str(r.get("RuleType") or ""),
                hit_count=int(r.get("HitCount") or 0),
                rules=_to_list(r.get("Rules")),
                actions=_to_list(r.get("Actions")),
                policies=_to_list(r.get("Policies")),
            )
            for r in fw_rows
        ]

    # Extended data: timeline, top peers, port heatmap
    timeline: list[TimelineBucket] = []
    top_peers: list[PeerEntry] = []
    port_heatmap: list[HeatmapEntry] = []

    for ws_id in filter(None, [settings.law_prod_nta_id, settings.law_dev_nta_id]):
        if not timeline:
            tl_rows = run_query(ws_id, build_vm_timeline_query(resolved_name, start, end, use_contains=use_contains), start, end)
            timeline = _parse_timeline(tl_rows)
        if not top_peers:
            peer_rows = run_query(ws_id, build_vm_top_peers_query(resolved_name, start, end, use_contains=use_contains), start, end)
            top_peers = _parse_top_peers(peer_rows)
        if not port_heatmap:
            hm_rows = run_query(ws_id, build_vm_port_heatmap_query(resolved_name, start, end, use_contains=use_contains), start, end)
            port_heatmap = _parse_port_heatmap(hm_rows)

    deny_summary = _build_deny_summary(inbound, outbound)

    resp = VMDetailResponse(
        vm=VMInfo(name=resolved_name, display_name=display_name, ip=vm_ip, subnet=vm_subnet),
        inbound=inbound,
        outbound=outbound,
        firewall_hits=firewall_hits,
        timeline=timeline,
        top_peers=top_peers,
        port_heatmap=port_heatmap,
        deny_summary=deny_summary,
    )
    cache[cache_key] = resp
    return resp
