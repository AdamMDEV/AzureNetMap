from datetime import datetime, timezone

import pytest

from app.kql.queries import (
    _safe_ip,
    _safe_search_term,
    _safe_vm_name,
    build_firewall_query,
    build_search_query,
    build_topology_query,
    build_vm_detail_query,
)

_START = datetime(2024, 1, 1, tzinfo=timezone.utc)
_END = datetime(2024, 1, 2, tzinfo=timezone.utc)


class TestSafeVmName:
    def test_normal(self):
        assert _safe_vm_name("my-vm.prod") == "my-vm.prod"

    def test_strips_semicolons_and_quotes(self):
        result = _safe_vm_name("vm'; DROP TABLE--")
        assert "'" not in result
        assert ";" not in result

    def test_max_length(self):
        assert len(_safe_vm_name("a" * 200)) == 128


class TestSafeIp:
    def test_valid_ipv4(self):
        assert _safe_ip("192.168.1.1") == "192.168.1.1"

    def test_invalid_returns_empty(self):
        assert _safe_ip("not-an-ip") == ""
        assert _safe_ip("'; DROP--") == ""

    def test_valid_ipv6(self):
        assert _safe_ip("::1") == "::1"

    def test_strips_whitespace(self):
        assert _safe_ip(" 10.0.0.1 ") == "10.0.0.1"


class TestSafeSearchTerm:
    def test_normal(self):
        assert _safe_search_term("my-vm 1") == "my-vm 1"

    def test_strips_injection_chars(self):
        result = _safe_search_term('vm"; exec()')
        assert '"' not in result
        assert ";" not in result


class TestBuildTopologyQuery:
    def test_contains_table(self):
        q = build_topology_query(_START, _END)
        assert "NTANetAnalytics" in q

    def test_flow_type_all_includes_both(self):
        q = build_topology_query(_START, _END, "all")
        assert '"Allowed"' in q
        assert '"Denied"' in q

    def test_flow_type_allowed_only(self):
        q = build_topology_query(_START, _END, "allowed")
        assert '"Allowed"' in q
        assert '"Denied"' not in q

    def test_flow_type_denied_only(self):
        q = build_topology_query(_START, _END, "denied")
        assert '"Denied"' in q
        assert '"Allowed"' not in q

    def test_time_range_embedded(self):
        q = build_topology_query(_START, _END)
        assert "2024-01-01" in q
        assert "2024-01-02" in q

    def test_has_summarize(self):
        q = build_topology_query(_START, _END)
        assert "summarize" in q


class TestBuildVmDetailQuery:
    def test_contains_table(self):
        q = build_vm_detail_query("my-vm", _START, _END)
        assert "NTANetAnalytics" in q

    def test_vm_name_embedded(self):
        q = build_vm_detail_query("my-vm", _START, _END)
        assert "my-vm" in q

    def test_injection_stripped(self):
        q = build_vm_detail_query('vm"; exec(arbitrary)', _START, _END)
        assert "exec(arbitrary)" not in q
        assert ";" not in q.split("NTANetAnalytics")[1][:50]

    def test_has_direction_extend(self):
        q = build_vm_detail_query("vm1", _START, _END)
        assert "Direction" in q


class TestBuildFirewallQuery:
    def test_contains_all_tables(self):
        q = build_firewall_query(["1.1.1.1"], ["2.2.2.2"], _START, _END)
        assert "AZFWNetworkRule" in q
        assert "AZFWApplicationRule" in q
        assert "AZFWNatRule" in q

    def test_valid_ips_in_query(self):
        q = build_firewall_query(["1.1.1.1"], ["2.2.2.2"], _START, _END)
        assert "1.1.1.1" in q
        assert "2.2.2.2" in q

    def test_invalid_ips_replaced_with_fallback(self):
        q = build_firewall_query(["bad-ip"], ["also-bad"], _START, _END)
        assert "bad-ip" not in q
        assert "also-bad" not in q
        assert "0.0.0.0" in q


class TestBuildSearchQuery:
    def test_contains_table(self):
        q = build_search_query("my-vm")
        assert "NTANetAnalytics" in q

    def test_term_embedded(self):
        q = build_search_query("my-vm")
        assert "my-vm" in q

    def test_injection_stripped(self):
        q = build_search_query('"; exec()')
        assert "exec()" not in q
