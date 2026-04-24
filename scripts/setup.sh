#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== AzureNetMap Setup ==="

# Step 1: Verify MI auth
echo "[1/7] Verifying Azure CLI / MI auth..."
if ! az account show --query id -o tsv &>/dev/null; then
  echo "ERROR: 'az account show' failed. Ensure managed identity is enabled and Azure CLI is logged in." >&2
  exit 1
fi
SUB_ID=$(az account show --query id -o tsv)
echo "    Subscription: $(az account show --query name -o tsv) ($SUB_ID)"

# Step 2: Discover LAW resource IDs across all accessible subscriptions
echo "[2/7] Discovering Log Analytics Workspace resource IDs..."

LAW_NAMES=("LAW-USFirewall-US-P" "LAW-USPNetworkMetrics-US-P" "LAW-NetworkAnalytics-US-D")
declare -A LAW_IDS

for NAME in "${LAW_NAMES[@]}"; do
  # Use customerId (workspace GUID) — the SDK's query_workspace requires the GUID, not the resource ID
  ID=$(az monitor log-analytics workspace list \
    --query "[?name=='$NAME'].customerId | [0]" -o tsv 2>/dev/null || true)
  if [[ -z "$ID" ]]; then
    ALL_SUBS=$(az account list --query "[].id" -o tsv 2>/dev/null)
    for SUB in $ALL_SUBS; do
      ID=$(az monitor log-analytics workspace list \
        --subscription "$SUB" \
        --query "[?name=='$NAME'].customerId | [0]" -o tsv 2>/dev/null || true)
      [[ -n "$ID" ]] && break
    done
  fi
  if [[ -z "$ID" ]]; then
    echo "  WARNING: Could not find workspace '$NAME'. Will leave placeholder in .env." >&2
    LAW_IDS[$NAME]="WORKSPACE_NOT_FOUND_$NAME"
  else
    echo "    $NAME -> $ID"
    LAW_IDS[$NAME]="$ID"
  fi
done

# Step 3: Write .env
echo "[3/7] Writing .env..."
cat > "$PROJECT_DIR/.env" <<EOF
LAW_FIREWALL_ID=${LAW_IDS[LAW-USFirewall-US-P]}
LAW_PROD_NTA_ID=${LAW_IDS[LAW-USPNetworkMetrics-US-P]}
LAW_DEV_NTA_ID=${LAW_IDS[LAW-NetworkAnalytics-US-D]}
CACHE_TTL_SECONDS=300
DEFAULT_TIME_RANGE_HOURS=24
MAX_TIME_RANGE_DAYS=30
LOG_LEVEL=INFO
EOF
echo "    .env written."

# Step 4: Generate self-signed cert if not present
echo "[4/7] Checking TLS cert..."
CERT_DIR="$PROJECT_DIR/nginx/certs"
mkdir -p "$CERT_DIR"
if [[ ! -f "$CERT_DIR/server.crt" ]] || [[ ! -f "$CERT_DIR/server.key" ]]; then
  echo "    Generating self-signed cert (2048-bit RSA, 365 days)..."
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -days 365 \
    -subj "/C=US/ST=State/L=City/O=AMES/CN=netmap.corp.placeholder.local" \
    -addext "subjectAltName=DNS:netmap.corp.placeholder.local,IP:127.0.0.1" \
    2>/dev/null
  chmod 600 "$CERT_DIR/server.key"
  echo "    Cert generated at $CERT_DIR/"
else
  echo "    Cert already exists, skipping."
fi

# Step 5: Create log dir
echo "[5/7] Creating log directory..."
sudo mkdir -p /var/log/azurenetmap
sudo chmod 755 /var/log/azurenetmap
echo "    /var/log/azurenetmap ready."

# Step 6: Build containers
echo "[6/7] Building Docker images..."
docker compose build

# Step 7: Done
echo "[7/7] Setup complete."
echo ""
echo "Next steps:"
echo "  docker compose up -d          # start the stack"
echo "  bash scripts/validate.sh      # run end-to-end validation"
echo "  sudo cp scripts/systemd/azurenetmap.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload && sudo systemctl enable azurenetmap.service"
