import ipaddress
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..cache import get_cache
from ..config import get_settings
from ..kql.client import run_query
from ..kql.queries import build_topology_query

router = APIRouter()
logger = logging.getLogger(__name__)


class NodeData(BaseModel):
    id: str
    label: str
    env: str
    ip: str
    vm_name: str = ""
    subnet: str = ""
    bytes_total: int = 0


class EdgeData(BaseModel):
    id: str
    source: str
    target: str
    bytes_total: int = 0
    packets_total: int = 0
    flow_count: int = 0
    flow_type: str = "Unknown"
    acl_rules: list[str] = []
    dest_ports: list[Any] = []
    protocols: list[str] = []


class CyNode(BaseModel):
    data: NodeData


class CyEdge(BaseModel):
    data: EdgeData


class TopologyResponse(BaseModel):
    nodes: list[CyNode]
    edges: list[CyEdge]


def _is_private(ip: str) -> bool:
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


def _classify_env(row_env: str, source_env: str, ip: str) -> str:
    """
    Derive display env from:
    - row_env: SrcEnvironment/DestEnvironment column ("Azure", "OnPrem", "Internet", etc.)
    - source_env: which LAW workspace the row came from ("prod"/"dev")
    - ip: IP address (private = Azure/OnPrem, public = external)
    """
    r = (row_env or "").lower()
    if "hub" in r:
        return "hub"
    if not _is_private(ip):
        return "external"
    if r == "onprem" or r == "on-prem":
        return "external"
    return source_env  # prod or dev from workspace


def _node_id(ip: str) -> str:
    return "ip_" + ip.replace(".", "_").replace(":", "_")


def _build_graph(rows: list[dict], source_env: str) -> tuple[dict[str, dict], dict[str, dict]]:
    nodes: dict[str, dict] = {}
    edges: dict[str, dict] = {}

    for r in rows:
        src_ip = str(r.get("SrcIp") or "")
        dst_ip = str(r.get("DestIp") or "")
        if not src_ip or not dst_ip:
            continue

        src_vm = str(r.get("SrcVm") or "")
        dst_vm = str(r.get("DestVm") or "")
        src_env_col = str(r.get("SrcEnvironment") or "")
        dst_env_col = str(r.get("DestEnvironment") or "")
        src_subnet = str(r.get("SrcSubnet") or "")
        dst_subnet = str(r.get("DestSubnet") or "")
        bytes_total = int(r.get("BytesTotal") or 0)
        packets_total = int(r.get("PacketsTotal") or 0)
        flow_count = int(r.get("FlowCount") or 0)
        flow_type = str(r.get("FlowStatus") or "Unknown")
        acl_rules = [str(x) for x in (r.get("AclRules") or [])]
        dest_ports = list(r.get("DestPorts") or [])
        protocols = [str(x) for x in (r.get("Protocols") or [])]

        src_nid = _node_id(src_ip)
        dst_nid = _node_id(dst_ip)

        if src_nid not in nodes:
            nodes[src_nid] = {
                "id": src_nid,
                "label": src_vm if src_vm else src_ip,
                "env": _classify_env(src_env_col, source_env, src_ip),
                "ip": src_ip,
                "vm_name": src_vm,
                "subnet": src_subnet,
                "bytes_total": 0,
            }
        nodes[src_nid]["bytes_total"] += bytes_total

        if dst_nid not in nodes:
            nodes[dst_nid] = {
                "id": dst_nid,
                "label": dst_vm if dst_vm else dst_ip,
                "env": _classify_env(dst_env_col, source_env, dst_ip),
                "ip": dst_ip,
                "vm_name": dst_vm,
                "subnet": dst_subnet,
                "bytes_total": 0,
            }
        nodes[dst_nid]["bytes_total"] += bytes_total

        edge_id = str(r.get("EdgeId") or f"{src_ip}->{dst_ip}")
        if edge_id in edges:
            edges[edge_id]["bytes_total"] += bytes_total
            edges[edge_id]["packets_total"] += packets_total
            edges[edge_id]["flow_count"] += flow_count
        else:
            edges[edge_id] = {
                "id": edge_id,
                "source": src_nid,
                "target": dst_nid,
                "bytes_total": bytes_total,
                "packets_total": packets_total,
                "flow_count": flow_count,
                "flow_type": flow_type,
                "acl_rules": acl_rules,
                "dest_ports": dest_ports,
                "protocols": protocols,
            }

    return nodes, edges


def _merge(
    all_nodes: dict[str, dict],
    all_edges: dict[str, dict],
    nodes: dict[str, dict],
    edges: dict[str, dict],
) -> None:
    for k, v in nodes.items():
        if k in all_nodes:
            all_nodes[k]["bytes_total"] += v["bytes_total"]
        else:
            all_nodes[k] = v
    for k, v in edges.items():
        if k in all_edges:
            all_edges[k]["bytes_total"] += v["bytes_total"]
            all_edges[k]["packets_total"] += v["packets_total"]
            all_edges[k]["flow_count"] += v["flow_count"]
        else:
            all_edges[k] = v


@router.get("/topology", response_model=TopologyResponse)
async def topology(
    env: str = Query("all", pattern="^(prod|dev|hub|all)$"),
    flow_type: str = Query("all", pattern="^(allowed|denied|all)$"),
    hours: int = Query(24, ge=1, le=720),
) -> TopologyResponse:
    cache = get_cache("topology")
    cache_key = f"topology:{env}:{flow_type}:{hours}"
    if cache_key in cache:
        return cache[cache_key]  # type: ignore[return-value]

    settings = get_settings()
    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours)
    query = build_topology_query(start, end, flow_type)

    all_nodes: dict[str, dict] = {}
    all_edges: dict[str, dict] = {}

    if env in ("prod", "all", "hub") and settings.law_prod_nta_id:
        rows = run_query(settings.law_prod_nta_id, query, start, end)
        n, e = _build_graph(rows, "prod")
        _merge(all_nodes, all_edges, n, e)

    if env in ("dev", "all") and settings.law_dev_nta_id:
        rows = run_query(settings.law_dev_nta_id, query, start, end)
        n, e = _build_graph(rows, "dev")
        _merge(all_nodes, all_edges, n, e)

    resp = TopologyResponse(
        nodes=[CyNode(data=NodeData(**v)) for v in all_nodes.values()],
        edges=[CyEdge(data=EdgeData(**v)) for v in all_edges.values()],
    )
    cache[cache_key] = resp
    return resp
