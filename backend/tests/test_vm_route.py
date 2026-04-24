"""Tests for /api/vm/{vm_name} path-prefix stripping and edge cases."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.routes.vm import _resolve_vm_name

client = TestClient(app)

_MOCK_SETTINGS = Settings(
    law_firewall_id="/subscriptions/test/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/fw",
    law_prod_nta_id="/subscriptions/test/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/prod",
    law_dev_nta_id="",
)

_MOCK_FLOW_ROWS = [
    {
        "TimeGenerated": None,
        "Direction": "Outbound",
        "SrcIp": "10.0.0.5",
        "DestIp": "10.0.0.6",
        "SrcVm": "my-vm",
        "DestVm": "other-vm",
        "DestPort": 443,
        "L4Protocol": "TCP",
        "FlowType": "IntraVNet",
        "FlowStatus": "Allowed",
        "AclRule": "allow-https",
        "BytesSrcToDest": 1024,
        "BytesDestToSrc": 512,
        "PacketsSrcToDest": 10,
        "PacketsDestToSrc": 8,
        "SrcSubnet": "10.0.0.0/24",
        "DestSubnet": "10.0.1.0/24",
    }
]


class TestResolveVmName:
    def test_plain_name(self):
        display, resolved = _resolve_vm_name("my-vm")
        assert display == "my-vm"
        assert resolved == "my-vm"

    def test_path_prefix_stripped(self):
        display, resolved = _resolve_vm_name("rg-foo/my-vm")
        assert display == "rg-foo/my-vm"
        assert resolved == "my-vm"

    def test_deep_path_prefix(self):
        _, resolved = _resolve_vm_name("a/b/c/my-vm")
        assert resolved == "my-vm"

    def test_empty_string(self):
        display, resolved = _resolve_vm_name("")
        assert display == ""
        assert resolved == ""


class TestVMRouteInputs:
    def test_plain_name_returns_200(self):
        with patch("app.routes.vm.run_query", return_value=[]):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/vm/my-vm-2")
        assert resp.status_code == 200

    def test_path_prefix_name_returns_200(self):
        # Path-style VM name (slash decoded by ASGI into multi-segment path)
        # route uses {vm_name:path} to capture everything after /vm/
        with patch("app.routes.vm.run_query", return_value=[]):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/vm/rg-foo/my-vm-3")
        assert resp.status_code == 200

    def test_nonexistent_vm_returns_200_not_500(self):
        with patch("app.routes.vm.run_query", return_value=[]):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/vm/definitely-does-not-exist-xyzzy")
        assert resp.status_code == 200
        data = resp.json()
        assert data["inbound"] == []
        assert data["outbound"] == []

    def test_vm_with_data_returns_flows(self):
        with patch("app.routes.vm.run_query", return_value=_MOCK_FLOW_ROWS):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                resp = client.get("/api/vm/my-vm-4")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["inbound"]) + len(data["outbound"]) > 0

    def test_response_has_extended_fields(self):
        with patch("app.routes.vm.run_query", return_value=[]):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/vm/extended-check-vm").json()
        assert "timeline" in data
        assert "top_peers" in data
        assert "port_heatmap" in data
        assert "deny_summary" in data

    def test_deny_summary_populated(self):
        denied_rows = [
            {**_MOCK_FLOW_ROWS[0], "FlowStatus": "Denied", "AclRule": "block-rule"},
        ]
        with patch("app.routes.vm.run_query", return_value=denied_rows):
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                data = client.get("/api/vm/deny-test-vm").json()
        ds = data["deny_summary"]
        assert ds["count"] > 0

    def test_hours_parameter_respected(self):
        with patch("app.routes.vm.run_query", return_value=[]) as mock_rq:
            with patch("app.routes.vm.get_settings", return_value=_MOCK_SETTINGS):
                client.get("/api/vm/hours-test-vm?hours=1")
        assert mock_rq.called
