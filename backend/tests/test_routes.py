from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app

client = TestClient(app)

_MOCK_SETTINGS = Settings(
    law_firewall_id="/subscriptions/test/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/fw",
    law_prod_nta_id="/subscriptions/test/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/prod",
    law_dev_nta_id="/subscriptions/test/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/dev",
)

_MOCK_FLOW_ROWS = [
    {
        "SrcIp": "10.0.0.1",
        "DestIp": "10.0.0.2",
        "SrcVm": "vm-prod-1",
        "DestVm": "vm-prod-2",
        "SrcVnet": "vnet-prod",
        "DestVnet": "vnet-prod",
        "SrcSubnet": "subnet-prod",
        "DestSubnet": "subnet-prod",
        "FlowType": "Allowed",
        "BytesTotal": 1024,
        "PacketsTotal": 10,
        "FlowCount": 1,
        "AclRules": ["allow-all"],
        "DestPorts": [443],
        "Protocols": ["TCP"],
        "EdgeId": "10.0.0.1->10.0.0.2",
    }
]


class TestHealthEndpoint:
    def test_returns_200(self):
        with patch("app.routes.health.run_query", return_value=[{"print_0": "ok"}]):
            with patch("app.routes.health.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_response_shape(self):
        with patch("app.routes.health.run_query", return_value=[{"print_0": "ok"}]):
            with patch("app.routes.health.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/health").json()
        assert "status" in data
        assert "timestamp" in data
        assert "law_reachable" in data
        assert "cache_stats" in data

    def test_law_unreachable_on_empty(self):
        with patch("app.routes.health.run_query", return_value=[]):
            with patch("app.routes.health.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/health").json()
        assert data["law_reachable"] is False


class TestTopologyEndpoint:
    def test_returns_200(self):
        with patch("app.routes.topology.run_query", return_value=_MOCK_FLOW_ROWS):
            with patch("app.routes.topology.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/topology")
        assert resp.status_code == 200

    def test_response_has_nodes_and_edges(self):
        with patch("app.routes.topology.run_query", return_value=_MOCK_FLOW_ROWS):
            with patch("app.routes.topology.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/topology").json()
        assert "nodes" in data
        assert "edges" in data

    def test_nodes_have_required_fields(self):
        with patch("app.routes.topology.run_query", return_value=_MOCK_FLOW_ROWS):
            with patch("app.routes.topology.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/topology").json()
        assert len(data["nodes"]) > 0
        node = data["nodes"][0]["data"]
        assert "id" in node
        assert "label" in node
        assert "env" in node
        assert "ip" in node

    def test_edges_have_required_fields(self):
        with patch("app.routes.topology.run_query", return_value=_MOCK_FLOW_ROWS):
            with patch("app.routes.topology.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/topology").json()
        assert len(data["edges"]) > 0
        edge = data["edges"][0]["data"]
        assert "source" in edge
        assert "target" in edge
        assert "flow_type" in edge

    def test_invalid_env_param(self):
        resp = client.get("/api/topology?env=invalid")
        assert resp.status_code == 422

    def test_invalid_flow_type(self):
        resp = client.get("/api/topology?flow_type=invalid")
        assert resp.status_code == 422

    def test_empty_result_on_no_data(self):
        with patch("app.routes.topology.run_query", return_value=[]):
            with patch("app.routes.topology.get_settings", return_value=_MOCK_SETTINGS):
                # Use hours=2 to bypass the cache populated by earlier tests (key=topology:all:all:24)
                data = client.get("/api/topology?hours=2").json()
        assert data["nodes"] == []
        assert data["edges"] == []


class TestSearchEndpoint:
    def test_returns_200(self):
        mock_rows = [{"VmName": "vm-1", "Ip": "10.0.0.1", "Subnet": "sub", "Vnet": "vnet"}]
        with patch("app.routes.search.run_query", return_value=mock_rows):
            with patch("app.routes.search.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/search?q=vm-1")
        assert resp.status_code == 200

    def test_response_has_results(self):
        mock_rows = [{"VmName": "vm-1", "Ip": "10.0.0.1", "Subnet": "sub", "Vnet": "vnet"}]
        with patch("app.routes.search.run_query", return_value=mock_rows):
            with patch("app.routes.search.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/search?q=vm-1").json()
        assert "results" in data
        assert len(data["results"]) == 1

    def test_missing_q_returns_422(self):
        resp = client.get("/api/search")
        assert resp.status_code == 422

    def test_empty_rows_return_empty_results(self):
        with patch("app.routes.search.run_query", return_value=[]):
            with patch("app.routes.search.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/search?q=nothing").json()
        assert data["results"] == []


class TestVMEndpoint:
    def test_returns_200(self):
        with patch("app.routes.vm.run_query", return_value=[]):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/vm/my-vm")
        assert resp.status_code == 200

    def test_response_shape(self):
        with patch("app.routes.vm.run_query", return_value=[]):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/vm/my-vm").json()
        assert "vm" in data
        assert "inbound" in data
        assert "outbound" in data
        assert "firewall_hits" in data
