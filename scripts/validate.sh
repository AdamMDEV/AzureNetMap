#!/usr/bin/env bash
set -euo pipefail

BASE="https://localhost"
PASS=0
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local jq_check="$3"

  local body
  body=$(curl -sk --max-time 15 "$url")
  local http_code
  http_code=$(curl -sk --max-time 15 -o /dev/null -w "%{http_code}" "$url")

  if [[ "$http_code" != "200" ]]; then
    echo "FAIL [$label] HTTP $http_code"
    FAIL=$((FAIL + 1))
    return
  fi

  if [[ -n "$jq_check" ]]; then
    if echo "$body" | jq -e "$jq_check" >/dev/null 2>&1; then
      echo "PASS [$label]"
      PASS=$((PASS + 1))
    else
      echo "FAIL [$label] jq check failed: $jq_check"
      echo "     Response: $(echo "$body" | head -c 200)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "PASS [$label] HTTP 200"
    PASS=$((PASS + 1))
  fi
}

echo "=== AzureNetMap Validation ==="

check "health - status ok"       "$BASE/api/health"         '.status == "ok"'
check "health - law_reachable"   "$BASE/api/health"         '.law_reachable == true'
check "topology - 200"           "$BASE/api/topology?hours=1"  '.nodes | type == "array"'
check "topology - has edges key" "$BASE/api/topology?hours=1"  'has("edges")'
check "search - 200"             "$BASE/api/search?q=test"  '.results | type == "array"'
check "frontend - serves html"   "$BASE/"                   ""

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
