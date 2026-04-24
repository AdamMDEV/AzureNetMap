import type { HealthResponse, SearchResponse, TopologyFilters, TopologyResponse, VMDetailResponse } from '../types/api'

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
  })
  return apiFetch<TopologyResponse>(`/topology?${p}`)
}

export function fetchVMDetail(vmName: string, hours = 24): Promise<VMDetailResponse> {
  return apiFetch<VMDetailResponse>(`/vm/${encodeURIComponent(vmName)}?hours=${hours}`)
}

export function fetchSearch(q: string): Promise<SearchResponse> {
  return apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(q)}`)
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health')
}
