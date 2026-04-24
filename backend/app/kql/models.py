from typing import Any

from pydantic import BaseModel, Field


class TopologyFlow(BaseModel):
    src_ip: str = ""
    dest_ip: str = ""
    src_vm: str = ""
    dest_vm: str = ""
    src_subnet: str = ""
    dest_subnet: str = ""
    src_vnet: str = ""
    dest_vnet: str = ""
    flow_type: str = ""
    bytes_total: int = 0
    packets_total: int = 0
    flow_count: int = 0
    acl_rules: list[str] = Field(default_factory=list)
    dest_ports: list[Any] = Field(default_factory=list)
    protocols: list[str] = Field(default_factory=list)
    edge_id: str = ""


class VMFlow(BaseModel):
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
    packets_src_to_dest: int = 0
    packets_dest_to_src: int = 0


class IpDetails(BaseModel):
    ip: str = ""
    location: str = ""
    public_ip_details: str = ""
    threat_type: str = ""
    threat_description: str = ""
    is_threat: bool = False


class FirewallHit(BaseModel):
    source_ip: str = ""
    destination_ip: str = ""
    destination_port: Any = None
    protocol: str = ""
    rule_type: str = ""
    hit_count: int = 0
    rules: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    policies: list[str] = Field(default_factory=list)


class SearchEntry(BaseModel):
    vm_name: str = ""
    ip: str = ""
    subnet: str = ""
    vnet: str = ""
