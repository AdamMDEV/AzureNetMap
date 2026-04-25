from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class NSGRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: Literal["nsg"] = "nsg"
    name: str
    priority: int = Field(ge=100, le=4096)
    direction: Literal["Inbound", "Outbound"]
    source: str
    destination: str
    port: str
    protocol: Literal["TCP", "UDP", "Any"] = "TCP"
    action: Literal["Allow", "Deny"] = "Allow"
    nsg_name: str = ""
    status: Literal["Draft"] = "Draft"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class FirewallRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: Literal["firewall"] = "firewall"
    name: str
    rule_type: Literal["Network", "Application", "NAT"] = "Network"
    rule_collection: str = ""
    rule_collection_group: str = ""
    priority: int = Field(ge=100, le=65000)
    action: Literal["Allow", "Deny"] = "Allow"
    source_ips: str = ""
    destination: str = ""
    port: str = ""
    protocol: Literal["TCP", "UDP", "Any", "HTTP", "HTTPS"] = "TCP"
    translated_address: str = ""
    translated_port: str = ""
    status: Literal["Draft"] = "Draft"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


RuleModel = NSGRule | FirewallRule
