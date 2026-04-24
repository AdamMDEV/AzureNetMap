"""
KQL query builders with sanitized input embedding.

Schema verified 2026-04-24 against real LAWs. Key findings vs spec:
  - NTANetAnalytics: SrcVnet/DestVnet do NOT exist. Use SrcEnvironment/DestEnvironment instead.
  - AZFWApplicationRule: no DestinationIp column (FQDN-based); mapped to Fqdn in union.
  - AZFWNatRule: no Action column; synthesized as "NAT" in union.
  - AZFWApplicationRule: DestinationIp synthesized from Fqdn.

See backend/app/kql/schema_snapshots/ for full column listings.
"""

import ipaddress
import re
from datetime import datetime


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_vm_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "", name)[:128]


def _safe_search_term(term: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._: -]", "", term)[:128]


def _safe_ip(ip: str) -> str:
    try:
        return str(ipaddress.ip_address(ip.strip()))
    except ValueError:
        return ""


def _ip_list_kql(ips: list[str]) -> str:
    valid = [f'"{_safe_ip(ip)}"' for ip in ips if _safe_ip(ip)]
    return ", ".join(valid) if valid else '"0.0.0.0"'


def _flow_status_filter(flow_type: str) -> str:
    """
    NTANetAnalytics FlowStatus values: "Allowed", "Denied", "" (empty).
    FlowType is the topology type (IntraVNet, AzurePublic, etc.) — not allow/deny.
    (Schema verified 2026-04-24)
    """
    if flow_type.lower() == "allowed":
        return '| where FlowStatus == "Allowed"'
    if flow_type.lower() == "denied":
        return '| where FlowStatus == "Denied"'
    return '| where FlowStatus in ("Allowed", "Denied")'


def build_topology_query(
    start: datetime,
    end: datetime,
    flow_type: str = "all",
) -> str:
    # FlowStatus ("Allowed"/"Denied") is the allow/deny indicator; FlowType is topology class.
    # SrcVnet/DestVnet absent; SrcEnvironment/DestEnvironment used instead. (schema verified 2026-04-24)
    fs_filter = _flow_status_filter(flow_type)
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
{fs_filter}
| summarize
    BytesTotal = sum(BytesSrcToDest + BytesDestToSrc),
    PacketsTotal = sum(PacketsSrcToDest + PacketsDestToSrc),
    FlowCount = count(),
    AclRules = make_set(AclRule, 10),
    DestPorts = make_set(DestPort, 20),
    Protocols = make_set(L4Protocol, 5),
    TopologyTypes = make_set(FlowType, 5)
    by SrcIp, DestIp, SrcVm = tostring(SrcVm), DestVm = tostring(DestVm),
       SrcSubnet = tostring(SrcSubnet), DestSubnet = tostring(DestSubnet),
       SrcEnvironment = tostring(SrcEnvironment), DestEnvironment = tostring(DestEnvironment),
       FlowStatus
| extend EdgeId = strcat(SrcIp, "->", DestIp)
| take 5000"""


def build_vm_detail_query(
    vm_name: str,
    start: datetime,
    end: datetime,
) -> str:
    safe = _safe_vm_name(vm_name)
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where SrcVm =~ "{safe}" or DestVm =~ "{safe}"
| extend Direction = iff(SrcVm =~ "{safe}", "Outbound", "Inbound")
| project TimeGenerated, Direction, SrcIp, DestIp, SrcVm, DestVm,
          DestPort, L4Protocol, FlowType, FlowStatus, AclRule,
          BytesSrcToDest, BytesDestToSrc, PacketsSrcToDest, PacketsDestToSrc,
          SrcSubnet, DestSubnet
| order by TimeGenerated desc
| take 1000"""


def build_ip_enrichment_query(
    ips: list[str],
    start: datetime,
    end: datetime,
) -> str:
    ip_list = _ip_list_kql(ips)
    return f"""NTAIpDetails
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where Ip in ({ip_list})
| summarize arg_max(TimeGenerated, *) by Ip
| project Ip, Location, PublicIpDetails, ThreatType, ThreatDescription,
          IsThreat = isnotempty(ThreatType)"""


def build_firewall_query(
    src_ips: list[str],
    dst_ips: list[str],
    start: datetime,
    end: datetime,
) -> str:
    # AZFWApplicationRule has no DestinationIp (FQDN-based) — mapped to Fqdn.
    # AZFWNatRule has no Action — synthesized as "NAT".
    src_list = _ip_list_kql(src_ips)
    dst_list = _ip_list_kql(dst_ips)
    return f"""union
  (AZFWNetworkRule
   | project TimeGenerated, RuleType = "Network",
             SourceIp, DestinationIp, DestinationPort, Protocol, Rule, Action, Policy),
  (AZFWApplicationRule
   | project TimeGenerated, RuleType = "Application",
             SourceIp, DestinationIp = Fqdn, DestinationPort, Protocol, Rule, Action, Policy),
  (AZFWNatRule
   | project TimeGenerated, RuleType = "NAT",
             SourceIp, DestinationIp, DestinationPort, Protocol, Rule, Action = "NAT", Policy)
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where SourceIp in ({src_list}) or DestinationIp in ({dst_list})
| summarize
    HitCount = count(),
    Rules = make_set(Rule, 10),
    Actions = make_set(Action, 5),
    Policies = make_set(Policy, 5)
    by SourceIp, DestinationIp, DestinationPort, Protocol, RuleType
| take 2000"""


def build_search_query(term: str) -> str:
    safe = _safe_search_term(term)
    return f"""NTANetAnalytics
| where TimeGenerated > ago(24h)
| where SrcVm contains "{safe}" or DestVm contains "{safe}"
    or SrcIp == "{safe}" or DestIp == "{safe}"
| summarize by VmName = coalesce(SrcVm, DestVm), Ip = coalesce(SrcIp, DestIp),
             Subnet = coalesce(SrcSubnet, DestSubnet)
| take 50"""


def build_vm_timeline_query(
    vm_name: str,
    start: datetime,
    end: datetime,
    bin_size_minutes: int = 15,
) -> str:
    safe = _safe_vm_name(vm_name)
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where SrcVm =~ "{safe}" or DestVm =~ "{safe}"
| extend Direction = iff(SrcVm =~ "{safe}", "Outbound", "Inbound")
| summarize
    InboundBytes = sumif(BytesSrcToDest + BytesDestToSrc, Direction == "Inbound"),
    OutboundBytes = sumif(BytesSrcToDest + BytesDestToSrc, Direction == "Outbound"),
    InboundPackets = sumif(PacketsSrcToDest + PacketsDestToSrc, Direction == "Inbound"),
    OutboundPackets = sumif(PacketsSrcToDest + PacketsDestToSrc, Direction == "Outbound")
    by BucketStart = bin(TimeGenerated, {bin_size_minutes}m)
| order by BucketStart asc"""


def build_vm_top_peers_query(vm_name: str, start: datetime, end: datetime, limit: int = 10) -> str:
    safe = _safe_vm_name(vm_name)
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where SrcVm =~ "{safe}" or DestVm =~ "{safe}"
| extend
    PeerIp = iff(SrcVm =~ "{safe}", DestIp, SrcIp),
    PeerVm = iff(SrcVm =~ "{safe}", tostring(DestVm), tostring(SrcVm)),
    IsOutbound = SrcVm =~ "{safe}"
| summarize
    BytesTotal = sum(BytesSrcToDest + BytesDestToSrc),
    FlowCount = count(),
    HasInbound = countif(not IsOutbound) > 0,
    HasOutbound = countif(IsOutbound) > 0
    by PeerIp, PeerVm
| order by BytesTotal desc
| take {limit}"""


def build_vm_port_heatmap_query(vm_name: str, start: datetime, end: datetime) -> str:
    safe = _safe_vm_name(vm_name)
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where SrcVm =~ "{safe}" or DestVm =~ "{safe}"
| where isnotempty(DestPort)
| summarize FlowCount = count() by HourOfDay = hourofday(TimeGenerated), Port = tostring(DestPort)
| order by FlowCount desc
| take 200"""


def build_dashboard_summary_query(start: datetime, end: datetime) -> str:
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where isnotempty(SrcVm)
| summarize
    BytesTotal = sum(BytesSrcToDest + BytesDestToSrc),
    DeniedFlows = countif(FlowStatus == "Denied"),
    FlowCount = count()
    by VmName = tostring(SrcVm)
| summarize
    ActiveVms = dcount(VmName),
    TotalBytes = sum(BytesTotal),
    DeniedFlows = sum(DeniedFlows)"""


def build_top_talkers_query(start: datetime, end: datetime, limit: int = 10) -> str:
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where isnotempty(SrcVm)
| summarize
    BytesTotal = sum(BytesSrcToDest + BytesDestToSrc),
    PeerCount = dcount(DestIp),
    FlowCount = count()
    by VmName = tostring(SrcVm), Environment = tostring(SrcEnvironment)
| order by BytesTotal desc
| take {limit}"""


def build_top_denied_sources_query(start: datetime, end: datetime, limit: int = 10) -> str:
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where FlowStatus == "Denied"
| summarize
    DeniedCount = count(),
    TopDest = any(DestIp),
    TopDestVm = any(tostring(DestVm))
    by SrcIp
| order by DeniedCount desc
| take {limit}"""


def build_fw_leaders_query(start: datetime, end: datetime, limit: int = 10) -> str:
    return f"""union
  (AZFWNetworkRule
   | where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
   | project Rule, Action, Policy, RuleType = "Network"),
  (AZFWApplicationRule
   | where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
   | project Rule, Action, Policy, RuleType = "Application")
| summarize HitCount = count() by Rule, Action, Policy, RuleType
| order by HitCount desc
| take {limit}"""


def build_external_destinations_query(start: datetime, end: datetime, limit: int = 10) -> str:
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where FlowStatus == "Allowed"
| where isnotempty(DestIp)
| where not(ipv4_is_private(DestIp))
| summarize
    BytesTotal = sum(BytesSrcToDest + BytesDestToSrc),
    FlowCount = count()
    by DestIp
| order by BytesTotal desc
| take {limit}"""


def build_new_vms_query() -> str:
    return """NTANetAnalytics
| where TimeGenerated > ago(30d)
| where isnotempty(SrcVm)
| summarize FirstSeen = min(TimeGenerated) by VmName = tostring(SrcVm)
| where FirstSeen > ago(24h)
| order by FirstSeen desc
| take 5"""


def build_threat_hits_query(start: datetime, end: datetime) -> str:
    return f"""NTAIpDetails
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| where isnotempty(ThreatType)
| summarize
    LastSeen = max(TimeGenerated),
    HitCount = count()
    by Ip, ThreatType = tostring(ThreatType), ThreatDescription = tostring(ThreatDescription)
| order by LastSeen desc
| take 5"""


def build_flow_timeline_query(start: datetime, end: datetime, bin_minutes: int = 15) -> str:
    return f"""NTANetAnalytics
| where TimeGenerated between (datetime({_iso(start)}) .. datetime({_iso(end)}))
| summarize
    InboundBytes = sumif(BytesSrcToDest, FlowStatus == "Allowed"),
    OutboundBytes = sumif(BytesDestToSrc, FlowStatus == "Allowed"),
    DeniedCount = countif(FlowStatus == "Denied")
    by BucketStart = bin(TimeGenerated, {bin_minutes}m)
| order by BucketStart asc"""


def build_schema_query(table_name: str) -> str:
    safe_table = re.sub(r"[^a-zA-Z0-9]", "", table_name)
    return f"{safe_table} | getschema"
