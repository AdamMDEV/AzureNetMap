import type {
  DashboardSummary,
  ExternalDestination,
  FWLeader,
  FirewallRule,
  FlowTimelineBucket,
  HealthResponse,
  NSGRule,
  NewVm,
  RuleModel,
  SearchResponse,
  ThreatsResponse,
  TopDeniedSource,
  TopTalker,
  TopologyFilters,
  TopologyResponse,
  VMDetailResponse,
} from '../types/api'

const BASE = '/api'

async function apiFetch<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`)
  if (!resp.ok) {
    throw new Error(`API ${resp.status}: ${path}`)
  }
  return resp.json() as Promise<T>
}

export function fetchTopology(filters: TopologyFilters): Promise<TopologyResponse> {
  const p = new URLSearchParams({
    env: filters.env,
    flow_type: filters.flow_type,
    hours: String(filters.hours),
    include_unattributed: String(filters.include_unattributed),
    density_threshold: String(filters.density_threshold),
  })
  return apiFetch<TopologyResponse>(`/topology?${p}`)
}

export function fetchVMDetail(vmName: string, hours = 24): Promise<VMDetailResponse> {
  // Strip path prefix on the client side to avoid routing issues
  const resolved = vmName.includes('/') ? vmName.split('/').pop()! : vmName
  return apiFetch<VMDetailResponse>(`/vm/${encodeURIComponent(resolved)}?hours=${hours}`)
}

export function fetchSearch(q: string): Promise<SearchResponse> {
  return apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(q)}`)
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health')
}

// Dashboard
function dashHours(hours: number) {
  return `?hours=${hours}`
}

export function fetchDashboardSummary(hours = 24): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(`/dashboard/summary${dashHours(hours)}`)
}

export function fetchTopTalkers(hours = 24): Promise<{ items: TopTalker[] }> {
  return apiFetch<{ items: TopTalker[] }>(`/dashboard/top-talkers${dashHours(hours)}`)
}

export function fetchTopDenied(hours = 24): Promise<{ items: TopDeniedSource[] }> {
  return apiFetch<{ items: TopDeniedSource[] }>(`/dashboard/top-denied${dashHours(hours)}`)
}

export function fetchFWLeaders(hours = 24): Promise<{ items: FWLeader[] }> {
  return apiFetch<{ items: FWLeader[] }>(`/dashboard/fw-leaders${dashHours(hours)}`)
}

export function fetchExternalDestinations(hours = 24): Promise<{ items: ExternalDestination[] }> {
  return apiFetch<{ items: ExternalDestination[] }>(`/dashboard/external-destinations${dashHours(hours)}`)
}

export function fetchNewVms(): Promise<{ items: NewVm[] }> {
  return apiFetch<{ items: NewVm[] }>('/dashboard/new-vms')
}

export function fetchDashboardTimeline(hours = 24): Promise<{ items: FlowTimelineBucket[] }> {
  return apiFetch<{ items: FlowTimelineBucket[] }>(`/dashboard/timeline${dashHours(hours)}`)
}

export function fetchThreats(hours = 24): Promise<ThreatsResponse> {
  return apiFetch<ThreatsResponse>(`/dashboard/threats${dashHours(hours)}`)
}

// Rules
export function fetchRules(): Promise<{ items: RuleModel[] }> {
  return apiFetch<{ items: RuleModel[] }>('/rules')
}

export function fetchRule(id: string): Promise<RuleModel> {
  return apiFetch<RuleModel>(`/rules/${id}`)
}

export async function createRule(rule: Omit<NSGRule, 'id' | 'created_at' | 'updated_at' | 'status'> | Omit<FirewallRule, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<RuleModel> {
  const res = await fetch(`${BASE}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  })
  if (!res.ok) throw new Error(`API ${res.status}: /rules`)
  return res.json()
}

export async function updateRule(id: string, rule: RuleModel): Promise<RuleModel> {
  const res = await fetch(`${BASE}/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  })
  if (!res.ok) throw new Error(`API ${res.status}: /rules/${id}`)
  return res.json()
}

export async function deleteRule(id: string): Promise<void> {
  const res = await fetch(`${BASE}/rules/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`API ${res.status}: /rules/${id}`)
}

export function fetchRulesExport(format: 'cli' | 'json' = 'cli'): Promise<string> {
  return fetch(`${BASE}/rules/export?format=${format}`).then((r) => r.text())
}
