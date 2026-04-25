"""Tests for /api/rules CRUD endpoints and _to_list helper."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    store_path = data_dir / "rule-drafts.json"

    with patch("app.store.rule_drafts._get_store_path", return_value=store_path):
        from app.main import app
        with TestClient(app) as c:
            yield c


class TestRulesEndpoints:
    def test_get_rules_empty(self, client):
        resp = client.get("/api/rules")
        assert resp.status_code == 200
        assert resp.json()["items"] == []

    def test_create_nsg_rule(self, client):
        payload = {
            "type": "nsg",
            "name": "test-rule",
            "priority": 200,
            "direction": "Inbound",
            "source": "10.0.0.0/16",
            "destination": "*",
            "port": "443",
            "protocol": "TCP",
            "action": "Allow",
            "nsg_name": "nsg-test",
        }
        resp = client.post("/api/rules", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test-rule"
        assert data["type"] == "nsg"
        assert data["status"] == "Draft"
        assert "id" in data

    def test_create_firewall_rule(self, client):
        payload = {
            "type": "firewall",
            "name": "fw-test",
            "rule_type": "Network",
            "priority": 300,
            "action": "Allow",
            "source_ips": "*",
            "destination": "10.1.0.0/16",
            "port": "443",
            "protocol": "TCP",
        }
        resp = client.post("/api/rules", json=payload)
        assert resp.status_code == 201
        assert resp.json()["name"] == "fw-test"

    def test_list_rules_after_create(self, client):
        client.post("/api/rules", json={
            "type": "nsg",
            "name": "r1",
            "priority": 100,
            "direction": "Inbound",
            "source": "*",
            "destination": "*",
            "port": "80",
            "protocol": "TCP",
            "action": "Allow",
        })
        resp = client.get("/api/rules")
        assert len(resp.json()["items"]) == 1

    def test_get_rule_by_id(self, client):
        create_resp = client.post("/api/rules", json={
            "type": "nsg",
            "name": "get-test",
            "priority": 150,
            "direction": "Outbound",
            "source": "*",
            "destination": "*",
            "port": "22",
            "protocol": "TCP",
            "action": "Deny",
        })
        rule_id = create_resp.json()["id"]
        get_resp = client.get(f"/api/rules/{rule_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["name"] == "get-test"

    def test_get_nonexistent_rule_returns_404(self, client):
        resp = client.get("/api/rules/nonexistent-id")
        assert resp.status_code == 404

    def test_delete_rule(self, client):
        cr = client.post("/api/rules", json={
            "type": "nsg",
            "name": "delete-me",
            "priority": 100,
            "direction": "Inbound",
            "source": "*",
            "destination": "*",
            "port": "80",
            "protocol": "TCP",
            "action": "Allow",
        })
        rule_id = cr.json()["id"]
        del_resp = client.delete(f"/api/rules/{rule_id}")
        assert del_resp.status_code == 204
        assert client.get(f"/api/rules/{rule_id}").status_code == 404

    def test_deploy_returns_501(self, client):
        cr = client.post("/api/rules", json={
            "type": "nsg",
            "name": "deploy-test",
            "priority": 100,
            "direction": "Inbound",
            "source": "*",
            "destination": "*",
            "port": "80",
            "protocol": "TCP",
            "action": "Allow",
        })
        rule_id = cr.json()["id"]
        resp = client.post(f"/api/rules/{rule_id}/deploy")
        assert resp.status_code == 501


class TestToList:
    def test_list_passthrough(self):
        from app.routes.vm import _to_list
        assert _to_list(["Allow", "Deny"]) == ["Allow", "Deny"]

    def test_json_string_decoded(self):
        from app.routes.vm import _to_list
        assert _to_list('["Allow"]') == ["Allow"]

    def test_empty_string(self):
        from app.routes.vm import _to_list
        assert _to_list("") == []

    def test_none(self):
        from app.routes.vm import _to_list
        assert _to_list(None) == []

    def test_empty_list(self):
        from app.routes.vm import _to_list
        assert _to_list([]) == []

    def test_multi_element_json_string(self):
        from app.routes.vm import _to_list
        assert _to_list('["Allow", "AllowIntraVNET"]') == ["Allow", "AllowIntraVNET"]


class TestChangelogEndpoint:
    def test_changelog_returns_200(self):
        from app.main import app
        with TestClient(app) as client:
            resp = client.get("/api/changelog")
            assert resp.status_code == 200
            data = resp.json()
            assert "content" in data
            assert isinstance(data["content"], str)
