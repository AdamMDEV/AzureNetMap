import fcntl
import json
import logging
from pathlib import Path
from typing import Union

from ..models.rules import FirewallRule, NSGRule

logger = logging.getLogger(__name__)

_STORE_PATHS = [
    Path("/app/data/rule-drafts.json"),
    Path(__file__).parent.parent.parent.parent / "data" / "rule-drafts.json",
]


def _get_store_path() -> Path:
    for p in _STORE_PATHS:
        if p.parent.exists():
            return p
    fallback = _STORE_PATHS[-1]
    fallback.parent.mkdir(parents=True, exist_ok=True)
    return fallback


def _load_raw() -> list[dict]:
    path = _get_store_path()
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            try:
                return json.load(f)
            except (json.JSONDecodeError, ValueError):
                return []
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
    except OSError:
        return []


def _save_raw(rules: list[dict]) -> None:
    path = _get_store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            json.dump(rules, f, indent=2, ensure_ascii=False)
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def _deserialize(raw: dict) -> Union[NSGRule, FirewallRule]:
    if raw.get("type") == "nsg":
        return NSGRule.model_validate(raw)
    return FirewallRule.model_validate(raw)


def list_rules() -> list[Union[NSGRule, FirewallRule]]:
    return [_deserialize(r) for r in _load_raw()]


def get_rule(rule_id: str) -> Union[NSGRule, FirewallRule, None]:
    for r in _load_raw():
        if r.get("id") == rule_id:
            return _deserialize(r)
    return None


def create_rule(rule: Union[NSGRule, FirewallRule]) -> Union[NSGRule, FirewallRule]:
    raw = _load_raw()
    raw.append(rule.model_dump())
    _save_raw(raw)
    return rule


def update_rule(rule_id: str, rule: Union[NSGRule, FirewallRule]) -> Union[NSGRule, FirewallRule, None]:
    raw = _load_raw()
    for i, r in enumerate(raw):
        if r.get("id") == rule_id:
            updated = rule.model_dump()
            updated["id"] = rule_id
            raw[i] = updated
            _save_raw(raw)
            return _deserialize(updated)
    return None


def delete_rule(rule_id: str) -> bool:
    raw = _load_raw()
    new_raw = [r for r in raw if r.get("id") != rule_id]
    if len(new_raw) == len(raw):
        return False
    _save_raw(new_raw)
    return True
