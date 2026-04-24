# AzureNetMap

Read-only internal web app that visualizes Azure network flows as an interactive topology graph.
Queries Log Analytics workspaces (NTA + Firewall) via VM managed identity.

## Architecture

```
nginx (443/80) → FastAPI + uvicorn (8000) → Azure Log Analytics
                        ↑
               React + Cytoscape.js (served as static files)
```

## First-time setup

```bash
bash scripts/setup.sh
```

This will:
1. Verify managed identity auth
2. Discover Log Analytics workspace resource IDs
3. Write `.env`
4. Generate a self-signed TLS cert in `nginx/certs/`
5. Build Docker images

## Start / stop

```bash
docker compose up -d      # start
docker compose down       # stop
docker compose logs -f    # tail logs
```

## Validate end-to-end

```bash
bash scripts/validate.sh
```

Expects `{status: "ok", law_reachable: true}` from the health endpoint.

## Enable on boot

```bash
sudo cp scripts/systemd/azurenetmap.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable azurenetmap.service
sudo systemctl start azurenetmap.service
```

## Swap self-signed cert for real cert

Replace the files nginx reads:
```bash
sudo cp your.crt /opt/claude-projects/AzureNetMap/nginx/certs/server.crt
sudo cp your.key /opt/claude-projects/AzureNetMap/nginx/certs/server.key
docker compose restart nginx
```

## Update DNS placeholder

Edit `nginx/nginx.conf`, replace `netmap.corp.placeholder.local` with your real hostname:
```bash
sed -i 's/netmap.corp.placeholder.local/netmap.corp.ames.local/g' nginx/nginx.conf
docker compose restart nginx
```

## Deploy updates

```bash
git pull
docker compose up -d --build
```

## Local dev (no Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env .
uvicorn app.main:app --reload --port 8000
```

**Frontend (separate terminal):**
```bash
cd frontend
npm ci
npm run dev   # proxies /api → localhost:8000
```

## KQL schema snapshots

Real table schemas are saved in `backend/app/kql/schema_snapshots/` after running setup.
If column names differ from queries in `backend/app/kql/queries.py`, adapt there.

## Logs

Logs are written via Docker's json-file driver, stored at `/var/log/azurenetmap/`.
Rotation: 50 MB × 5 files per container.
