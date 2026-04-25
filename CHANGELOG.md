# Changelog

All notable changes to AzureNetMap.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Adheres to [Semantic Versioning](https://semver.org/).

## [1.3.0] — 2026-04-25

### Added
- Persistent top navigation bar (Dashboard, Map, Threats, Rules tabs) on every page
- Rule Planner page at `/rules` — NSG and Firewall rule drafting UI (WIP, deployment not enabled)
- NSG and Firewall rule form at `/rules/new` and `/rules/:id/edit` with full validation
- "Add rule" button on VM detail panel and VM page — pre-fills rule form with VM context
- `POST /api/rules`, `GET /api/rules`, `PUT /api/rules/:id`, `DELETE /api/rules/:id`, `GET /api/rules/export` endpoints
- Changelog page at `/changelog` rendering `CHANGELOG.md` via `/api/changelog` endpoint
- Version badge in navigation bar (`v1.3.0`), clickable to changelog
- "What's new" first-visit toast on version change with dismiss and changelog link
- Keyboard navigation shortcuts: `g d` dashboard, `g m` map, `g t` threats, `g r` rules, `g c` changelog
- Visual hint `g…` while waiting for second key in navigation shortcut
- Pinned VMs section on dashboard (star icon on VM pages, localStorage)
- Recently viewed VMs section on dashboard (auto-recorded, localStorage)
- "Copy as Markdown" button on VM pages for quick ticket/incident documentation
- "Frequent peers" section on VM overview tab (top VM-to-VM peers by flow count)
- Page transitions via framer-motion (`opacity + y:4`, 150ms, respects `prefers-reduced-motion`)
- Loading progress bar (NProgress, cyan) during lazy route loading
- Azure CLI export dialog on Rule Planner page with copy + download
- `data/` directory and `data/*.json` gitignore for rule draft persistence
- File-locking (`fcntl`) on rule draft JSON store to prevent concurrent write corruption
- 15 new backend tests (rules CRUD, `_to_list`, changelog endpoint)
- Focus mode depth selector (1 / 2 / 3 hops) in FocusChip

### Changed
- Focus mode: now isolates subgraph (hides non-neighbors via CSS `display: none`), uses concentric layout with focused VM at center, animated 500ms transition
- "View on map" from VM page routes to `/map?focus=<vm>&depth=1` (direct focus mode entry)
- Map filter chips moved to dedicated filter bar below primary nav
- MapPage no longer has its own command palette — global search in TopNav used everywhere
- `g` key map shortcut removed (was cycling grouping); grouping still accessible via toolbar chip
- Keyboard shortcuts `onSearch` and `onHelp` lifted to global level (TopNav/App)
- Empty state messages refreshed with icons and friendlier copy
- `ShortcutDialog` updated with all new v1.3 shortcuts

### Fixed
- Firewall hits `rules` field rendering as character array when KQL `make_set` returned JSON-encoded string — `_to_list()` helper now safely decodes both `list` and `str` forms
- VM overview timeline / top peers / port heatmap returning empty when VM was found via contains-fallback but extended queries used exact `=~` match — `use_contains` flag now propagates to all three queries
- Duplicate command palette on Map page removed (global TopBar palette used instead)

### Removed
- Scattered "Open Map" and "Threats" buttons in TopBar (replaced by persistent primary nav tabs)

## [1.2.0] — 2026-04-24

### Added
- Landing dashboard at `/` with stat hero (active VMs, total bytes, denied flows with deltas), top talkers, top denied sources, FW rule leaders, external destinations, flow volume timeline, new VMs today, and threat hits (conditional on NTAIpDetails data)
- VM deep-drill page at `/vm/:name` with Overview / Inbound / Outbound / FW Hits / Deny analysis tabs
- Flow volume timeline chart per VM (recharts AreaChart, inbound + outbound stacked)
- Top peers bar chart per VM (recharts BarChart, horizontal)
- Port usage heatmap per VM (hour-of-day × port, color intensity by flow count)
- Search results page at `/search?q=` with auto-redirect on single exact match
- Threats page at `/threats` (conditional: empty state shown when no NTAIpDetails threat data)
- Toast notification system (Sonner) for API errors, exports, clipboard ops
- Skeleton loading states on dashboard tiles
- Empty state illustrations for no-data scenarios (dashboard, VM page, search, map)
- Animated count-up for dashboard hero numbers (react-countup, respects prefers-reduced-motion)
- Share current view button on map — copies URL to clipboard with toast confirmation
- React Router v6 with lazy-loaded pages
- Breadcrumb navigation in top bar (contextual per-page)
- Backend: `/api/vm/{name}` extended with `timeline`, `top_peers`, `port_heatmap`, `deny_summary`
- Backend: 8 new dashboard endpoints (`/api/dashboard/summary`, `top-talkers`, `top-denied`, `fw-leaders`, `external-destinations`, `new-vms`, `timeline`, `threats`)
- Backend: 11 new KQL query builders (`build_vm_timeline_query`, `build_vm_top_peers_query`, `build_vm_port_heatmap_query`, `build_dashboard_summary_query`, `build_top_talkers_query`, `build_top_denied_sources_query`, `build_fw_leaders_query`, `build_external_destinations_query`, `build_new_vms_query`, `build_threat_hits_query`, `build_flow_timeline_query`)
- Backend: `VMDetailResponse` extended with `TimelineBucket`, `PeerEntry`, `HeatmapEntry`, `DenySummary` models
- Backend: `DashboardSummary` includes prior-period deltas for all three hero stats
- Test: `test_vm_route.py` — 7 cases covering path prefix stripping, URL-encoded names, empty VM, deny summary, extended fields
- Test: 10 additional dashboard endpoint tests in `test_routes.py`

### Changed
- Top bar restructured: logo + breadcrumbs left, command palette center, contextual controls right
- Map-specific controls (filter chips, grouping, density, share, export, settings) moved to Map sub-bar, hidden on other pages
- Node colors saturation increased: prod `#2563eb`, dev `#ea580c`, hub `#9333ea` (more vibrant)
- Edge glow colors brightened to match new saturations
- Default fcose layout: `nodeSeparation 180`, `nodeRepulsion 10000`, `idealEdgeLength 160`, `nestingFactor 0.05` — significantly less hairball
- Label visibility thresholds: hide at zoom < 0.8 (was < 0.6), show high-connectivity only at zoom < 1.4 (peer_count ≥ 5 threshold, replaces 80th-percentile logic)
- VM detail panel on map now has "Full detail" button linking to `/vm/:name`
- `VMInfo` model includes `display_name` field (original path-prefixed name for display)
- Backend route `/api/vm/{vm_name:path}` — matches multi-segment paths (handles slashes in VM names)

### Fixed
- VM detail "Failed to load details" — backend `/api/vm/{name:path}` now captures multi-segment paths; frontend strips path prefix before API call; backend `_resolve_vm_name()` strips prefix as safety net; contains-search fallback when exact match returns 0 rows; DEBUG logging for resolution
- Unattributed filter default — LeftSidebar "Unattributed" row now hidden when `showUnattributed` toggle is OFF; StatusBar also respects setting
- Edge width encoding — changed from relative log-scale (looked uniform) to absolute `Math.log10(bytes+1) * 1.5` clamped to [1, 12]px — volume differences now clearly visible
- Label overlap — zoom thresholds raised, absolute peer_count threshold replaces percentile (was fragile with small datasets)
- fcose layout tuning: dramatically reduced hairball via nodeRepulsion + nodeSeparation + nestingFactor changes

### Security
- All new KQL query builders use `_safe_vm_name` / `_safe_ip` sanitization — no injection surface added

## [1.1.0] — 2026-04-24

### Added
- shadcn/ui component library integration (new-york style, slate base)
- Inter + JetBrains Mono fonts
- Vibrant dark theme with saturated accent colors
- Compound subnet grouping in topology graph (cytoscape-expand-collapse)
- fcose layout (replaces cose-bilkent)
- Edge animation for allowed flows (line-dash offset animation)
- Dashed red edges for denied flows
- Smart label visibility based on zoom level and peer_count
- Hover tooltips for nodes and edges
- Double-click focus mode (dim non-neighbors)
- Minimap overlay (cytoscape-navigator)
- Zoom controls (top-right canvas)
- Layout selector dropdown (fcose / concentric / breadthfirst / grid)
- Hub-spoke preset view
- Density slider (hide low-volume edges)
- Left sidebar: Legend, View Presets, Statistics
- Bottom status bar with counts, total bytes, deny count, last refresh
- Top bar filter chips with dropdowns
- Command palette search (cmdk-based)
- Keyboard shortcuts: /, f, Esc, d, a, g, l, m, +, -, ? with help dialog
- Settings popover: show unattributed, reduce motion, edge animation toggle
- Export dropdown: PNG full / PNG selection / CSV edges / SVG
- External node CIDR grouping (configurable via KNOWN_CORP_CIDRS env)
- Unattributed node handling (off by default, rose color when shown)
- Peer count per node (new backend field)
- Backend: topology response includes subnets, vnets, summary objects

### Changed
- Top bar redesigned with chips and dropdowns instead of scattered controls
- VM detail panel restyled with shadcn Tabs and cleaner info hierarchy
- Edge popup restyled as shadcn Popover
- Canvas background deepened to `#0a0e1a`

### Fixed
- Grouping metadata added to topology response

## [1.0.0] — 2026-04-24

### Added
- Initial release
- React + TypeScript + Vite frontend
- FastAPI + Python 3.12 backend
- Cytoscape.js network topology graph with cose-bilkent layout
- Cross-workspace KQL queries against 3 Log Analytics Workspaces (firewall + prod NTA + dev NTA)
- Schema-verified query builders for NTANetAnalytics, NTAIpDetails, AZFWNetworkRule, AZFWApplicationRule, AZFWNatRule
- Managed identity authentication via DefaultAzureCredential
- 5-minute in-memory TTL cache
- Topology view with VMs as nodes, flows as edges
- Per-VM drill-down side panel
- Search by VM name or IP
- Filter by environment (prod/dev/hub), flow type (allow/deny), time range (1h/24h/7d/30d)
- PNG export of current graph
- Docker Compose multi-stage build (Node build frontend → Python runtime)
- Nginx reverse proxy with self-signed TLS
- Systemd unit for VM boot auto-start
- Setup script for idempotent first-run (discover LAW GUIDs, generate .env, gen self-signed cert)
- Validation script for end-to-end checks
- 41 pytest test cases
