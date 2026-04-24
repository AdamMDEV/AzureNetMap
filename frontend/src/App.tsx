import { useQueryClient } from '@tanstack/react-query'
import type { Core } from 'cytoscape'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type { EdgeData, NodeData, SearchEntry } from './types/api'
import { ExportButton } from './components/ExportButton'
import { FilterPanel } from './components/FilterPanel'
import { SearchBar } from './components/SearchBar'
import { TopologyGraph } from './components/TopologyGraph'
import { VMDetailPanel } from './components/VMDetailPanel'
import { useTopology } from './hooks/useTopology'

export default function App() {
  const cyRef = useRef<Core | null>(null)
  const queryClient = useQueryClient()
  const {
    filters,
    setFilters,
    topology,
    isLoading,
    isError,
    error,
    selectedNode,
    setSelectedNode,
    setSelectedEdge,
  } = useTopology()

  const handleNodeClick = useCallback(
    (data: NodeData) => {
      setSelectedNode(data)
      setSelectedEdge(null)
    },
    [setSelectedNode, setSelectedEdge],
  )

  const handleEdgeClick = useCallback(
    (data: EdgeData) => {
      setSelectedEdge(data)
    },
    [setSelectedEdge],
  )

  const handleSearch = useCallback(
    (entry: SearchEntry) => {
      if (!cyRef.current) return
      const cy = cyRef.current
      const vmName = entry.vm_name || entry.ip
      const found = cy.nodes().filter((n) => {
        const d = n.data() as NodeData
        return d.vm_name === vmName || d.ip === entry.ip
      })
      if (found.length > 0) {
        cy.animate({ fit: { eles: found, padding: 80 } }, { duration: 400 })
        found.select()
        setSelectedNode(found.first().data() as NodeData)
      }
    },
    [setSelectedNode],
  )

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['topology'] })
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      <header className="flex items-center gap-4 px-4 py-2 border-b border-slate-700 shrink-0 h-12">
        <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">AzureNetMap</span>

        <div className="flex-1 flex justify-center">
          <SearchBar onSelect={handleSearch} />
        </div>

        <div className="flex items-center gap-3">
          <FilterPanel filters={filters} onChange={setFilters} />
          <button
            onClick={handleRefresh}
            title="Refresh"
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <ExportButton cyRef={cyRef} />
        </div>
      </header>

      {isError && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-950/50 border-b border-red-800 text-xs text-red-300">
          <AlertCircle size={12} />
          {error instanceof Error ? error.message : 'Failed to load topology'}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {isLoading && !topology && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm z-10">
              Loading topology...
            </div>
          )}
          <TopologyGraph
            topology={topology}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            cyRef={cyRef}
          />
          {topology && (
            <div className="absolute bottom-3 left-3 text-xs text-slate-600 pointer-events-none">
              {topology.nodes.length} nodes · {topology.edges.length} edges
            </div>
          )}
        </div>

        {selectedNode && (
          <VMDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </div>
    </div>
  )
}
