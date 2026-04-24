import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { fetchTopology } from '../api/client'
import type { EdgeData, EnvFilter, FlowFilter, NodeData, TopologyFilters } from '../types/api'

function readFiltersFromUrl(): TopologyFilters {
  const p = new URLSearchParams(window.location.search)
  return {
    env: (p.get('env') as EnvFilter) || 'all',
    flow_type: (p.get('flow_type') as FlowFilter) || 'all',
    hours: Number(p.get('hours')) || 24,
  }
}

function writeFiltersToUrl(filters: TopologyFilters): void {
  const p = new URLSearchParams({
    env: filters.env,
    flow_type: filters.flow_type,
    hours: String(filters.hours),
  })
  window.history.replaceState(null, '', `?${p}`)
}

export function useTopology() {
  const [filters, setFiltersState] = useState<TopologyFilters>(readFiltersFromUrl)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<EdgeData | null>(null)

  const setFilters = useCallback((next: Partial<TopologyFilters>) => {
    setFiltersState((prev) => {
      const updated = { ...prev, ...next }
      writeFiltersToUrl(updated)
      return updated
    })
  }, [])

  const query = useQuery({
    queryKey: ['topology', filters],
    queryFn: () => fetchTopology(filters),
  })

  return {
    filters,
    setFilters,
    topology: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    selectedNode,
    setSelectedNode,
    selectedEdge,
    setSelectedEdge,
  }
}
