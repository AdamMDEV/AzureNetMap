import logging
from datetime import datetime, timezone
from typing import Union

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from ..models.rules import FirewallRule, NSGRule
from ..store.rule_drafts import (
    create_rule,
    delete_rule,
    get_rule,
    list_rules,
    update_rule,
)

router = APIRouter()
logger = logging.getLogger(__name__)

RuleUnion = Union[NSGRule, FirewallRule]


@router.get("/rules")
async def get_rules() -> dict:
    rules = list_rules()
    return {"items": [r.model_dump() for r in rules]}


@router.get("/rules/export")
async def export_rules(format: str = "cli") -> PlainTextResponse:
    rules = list_rules()
    if format == "json":
        import json
        return PlainTextResponse(
            json.dumps([r.model_dump() for r in rules], indent=2),
            media_type="application/json",
        )
    lines = [f"# AzureNetMap rule export — {datetime.now(timezone.utc).isoformat()}", ""]
    for rule in rules:
        if isinstance(rule, NSGRule):
            lines.append(f"# NSG rule: {rule.name}")
            lines.append("az network nsg rule create \\")
            lines.append(f"  --resource-group <RG> \\")
            lines.append(f"  --nsg-name {rule.nsg_name or '<NSG-NAME>'} \\")
            lines.append(f"  --name {rule.name} \\")
            lines.append(f"  --priority {rule.priority} \\")
            lines.append(f"  --direction {rule.direction} \\")
            lines.append(f"  --access {rule.action} \\")
            lines.append(f"  --protocol {rule.protocol} \\")
            lines.append(f"  --source-address-prefixes '{rule.source}' \\")
            lines.append(f"  --destination-address-prefixes '{rule.destination}' \\")
            lines.append(f"  --destination-port-ranges {rule.port}")
            lines.append("")
        elif isinstance(rule, FirewallRule):
            lines.append(f"# Firewall rule: {rule.name} ({rule.rule_type})")
            lines.append("# Firewall CLI export varies by rule type — review before applying")
            lines.append(f"# Collection: {rule.rule_collection or '<COLLECTION>'}")
            lines.append(f"# Priority: {rule.priority}, Action: {rule.action}")
            lines.append(f"# Source: {rule.source_ips}, Dest: {rule.destination}, Port: {rule.port}")
            lines.append("")
    return PlainTextResponse("\n".join(lines), media_type="text/plain")


@router.get("/rules/{rule_id}")
async def get_rule_by_id(rule_id: str) -> dict:
    rule = get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule.model_dump()


@router.post("/rules", status_code=201)
async def create_new_rule(rule: RuleUnion) -> dict:
    created = create_rule(rule)
    return created.model_dump()


@router.put("/rules/{rule_id}")
async def update_existing_rule(rule_id: str, rule: RuleUnion) -> dict:
    updated = update_rule(rule_id, rule)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return updated.model_dump()


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_existing_rule(rule_id: str) -> None:
    if not delete_rule(rule_id):
        raise HTTPException(status_code=404, detail="Rule not found")


@router.post("/rules/{rule_id}/deploy", status_code=501)
async def deploy_rule(rule_id: str) -> dict:
    return {"detail": "Deployment not enabled in v1.3 — coming in a future release"}
