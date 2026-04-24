import ipaddress
import logging
import statistics
from collections import defaultdict
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
    vnet: str = ""
    subscription: str = ""
    bytes_total: int = 0
    peer_count: int = 0


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


class SubnetGroup(BaseModel):
    id: str
    name: str
    vnet: str
    env: str
    node_count: int = 0
    total_bytes: int = 0


class VNetGroup(BaseModel):
    id: str
    name: str
    env: str
    subnet_count: int = 0
    node_count: int = 0


class Summary(BaseModel):
    total_bytes: int = 0
    total_packets: int = 0
    allow_count: int = 0
    deny_count: int = 0
    unattributed_count: int = 0


class CyNode(BaseModel):
    data: NodeData


class CyEdge(BaseModel):
    data: EdgeData


class TopologyResponse(BaseModel):
    nodes: list[CyNode]
    edges: list[CyEdge]
    subnets: list[SubnetGroup] = []
    vnets: list[VNetGroup] = []
    summary: Summary = Summary()


def _is_private(ip: str) -> bool:
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


def _classify_env(row_env: str, source_env: str, ip: str) -> str:
    r = (row_env or "").lower()
    if "hub" in r:
        return "hub"
    if not _is_private(ip):
        return "external"
    if r in ("onprem", "on-prem"):
        return "external"
    return source_env


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
        src_env = _classify_env(src_env_col, source_env, src_ip)
        dst_env = _classify_env(dst_env_col, source_env, dst_ip)

        if src_nid not in nodes:
            nodes[src_nid] = {
                "id": src_nid,
                "label": src_vm if src_vm else src_ip,
                "env": src_env,
                "ip": src_ip,
                "vm_name": src_vm,
                "subnet": src_subnet,
                "vnet": src_env,
                "subscription": source_env,
                "bytes_total": 0,
                "peer_count": 0,
            }
        nodes[src_nid]["bytes_total"] += bytes_total

        if dst_nid not in nodes:
            nodes[dst_nid] = {
                "id": dst_nid,
                "label": dst_vm if dst_vm else dst_ip,
                "env": dst_env,
                "ip": dst_ip,
                "vm_name": dst_vm,
                "subnet": dst_subnet,
                "vnet": dst_env,
                "subscription": source_env,
                "bytes_total": 0,
                "peer_count": 0,
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


def _compute_peer_counts(nodes: dict[str, dict], edges: dict[str, dict]) -> None:
    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in edges.values():
        src, tgt = edge["source"], edge["target"]
        adjacency[src].add(tgt)
        adjacency[tgt].add(src)
    for nid, node in nodes.items():
        node["peer_count"] = len(adjacency.get(nid, set()))


def _build_groups(nodes: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    subnet_map: dict[str, dict] = {}
    vnet_map: dict[str, dict] = {}

    for node in nodes.values():
        env = node["env"]
        subnet = node["subnet"]

        vnet_id = f"vnet:{env}"
        if vnet_id not in vnet_map:
            vnet_map[vnet_id] = {
                "id": vnet_id,
                "name": env,
                "env": env,
                "subnet_count": 0,
                "node_count": 0,
            }
        vnet_map[vnet_id]["node_count"] += 1

        if subnet:
            subnet_id = f"{env}:{subnet}"
            if subnet_id not in subnet_map:
                subnet_map[subnet_id] = {
                    "id": subnet_id,
                    "name": subnet,
                    "vnet": vnet_id,
                    "env": env,
                    "node_count": 0,
                    "total_bytes": 0,
                }
            subnet_map[subnet_id]["node_count"] += 1
            subnet_map[subnet_id]["total_bytes"] += node["bytes_total"]

    counted: set[str] = set()
    for sg in subnet_map.values():
        vnet_id = sg["vnet"]
        if vnet_id not in counted and vnet_id in vnet_map:
            vnet_map[vnet_id]["subnet_count"] += 1
            counted.add(f"{vnet_id}:{sg['id']}")

    return list(subnet_map.values()), list(vnet_map.values())


def _compute_summary(
    nodes: dict[str, dict], edges: dict[str, dict], unattributed_count: int
) -> dict:
    return {
        "total_bytes": sum(n["bytes_total"] for n in nodes.values()),
        "total_packets": sum(e["packets_total"] for e in edges.values()),
        "allow_count": sum(1 for e in edges.values() if e["flow_type"] == "Allowed"),
        "deny_count": sum(1 for e in edges.values() if e["flow_type"] == "Denied"),
        "unattributed_count": unattributed_count,
    }


def _apply_density_filter(edges: dict[str, dict], density_threshold: int) -> dict[str, dict]:
    if density_threshold <= 0 or len(edges) < 2:
        return edges
    byte_values = [e["bytes_total"] for e in edges.values()]
    try:
        quantile_list = statistics.quantiles(byte_values, n=100)
        idx = min(density_threshold - 1, len(quantile_list) - 1)
        byte_threshold = quantile_list[idx]
        return {k: v for k, v in edges.items() if v["bytes_total"] >= byte_threshold}
    except statistics.StatisticsError:
        return edges


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
    include_unattributed: bool = Query(False),
    density_threshold: int = Query(0, ge=0, le=95),
) -> TopologyResponse:
    cache = get_cache("topology")
    cache_key = f"topology:{env}:{flow_type}:{hours}:{include_unattributed}:{density_threshold}"
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

    unattributed_count = sum(1 for n in all_nodes.values() if not n.get("vm_name"))

    if not include_unattributed:
        unattr_ids = {nid for nid, n in all_nodes.items() if not n.get("vm_name")}
        all_nodes = {k: v for k, v in all_nodes.items() if k not in unattr_ids}
        all_edges = {
            k: v
            for k, v in all_edges.items()
            if v["source"] not in unattr_ids and v["target"] not in unattr_ids
        }

    _compute_peer_counts(all_nodes, all_edges)
    all_edges = _apply_density_filter(all_edges, density_threshold)

    subnets_data, vnets_data = _build_groups(all_nodes)
    summary_data = _compute_summary(all_nodes, all_edges, unattributed_count)

    resp = TopologyResponse(
        nodes=[CyNode(data=NodeData(**v)) for v in all_nodes.values()],
        edges=[CyEdge(data=EdgeData(**v)) for v in all_edges.values()],
        subnets=[SubnetGroup(**s) for s in subnets_data],
        vnets=[VNetGroup(**v) for v in vnets_data],
        summary=Summary(**summary_data),
    )
    cache[cache_key] = resp
    return resp
