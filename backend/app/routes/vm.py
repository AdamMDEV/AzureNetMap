import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..cache import get_cache
from ..config import get_settings
from ..kql.client import run_query
from ..kql.queries import build_firewall_query, build_vm_detail_query

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


class VMDetailResponse(BaseModel):
    vm: VMInfo
    inbound: list[FlowRecord]
    outbound: list[FlowRecord]
    firewall_hits: list[FirewallHit]


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


@router.get("/vm/{vm_name}", response_model=VMDetailResponse)
async def vm_detail(
    vm_name: str,
    hours: int = Query(24, ge=1, le=720),
) -> VMDetailResponse:
    cache = get_cache("vm")
    cache_key = f"vm:{vm_name.lower()}:{hours}"
    if cache_key in cache:
        return cache[cache_key]  # type: ignore[return-value]

    settings = get_settings()
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)
    query = build_vm_detail_query(vm_name, start, end)

    all_rows: list[dict] = []
    for ws_id in filter(None, [settings.law_prod_nta_id, settings.law_dev_nta_id]):
        all_rows.extend(run_query(ws_id, query, start, end))

    inbound, outbound, all_ips = _parse_flows(all_rows, vm_name)

    vm_ip, vm_subnet = "", ""
    if all_rows:
        first = all_rows[0]
        is_src = str(first.get("SrcVm") or "").lower() == vm_name.lower()
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
                rules=list(r.get("Rules") or []),
                actions=list(r.get("Actions") or []),
                policies=list(r.get("Policies") or []),
            )
            for r in fw_rows
        ]

    resp = VMDetailResponse(
        vm=VMInfo(name=vm_name, ip=vm_ip, subnet=vm_subnet),
        inbound=inbound,
        outbound=outbound,
        firewall_hits=firewall_hits,
    )
    cache[cache_key] = resp
    return resp
