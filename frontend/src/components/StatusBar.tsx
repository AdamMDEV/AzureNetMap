import { formatBytes, timeAgo } from '@/lib/utils'
import type { TopologyResponse } from '@/types/api'

interface Props {
  topology: TopologyResponse | undefined
  visibleNodes: number
  visibleEdges: number
  lastRefresh: Date | null
  isLoading: boolean
}

export function StatusBar({ topology, visibleNodes, visibleEdges, lastRefresh, isLoading }: Props) {
  const total = topology?.summary

  return (
    <div className="h-7 flex items-center justify-between px-4 bg-[#0d1117] border-t border-[#1f2937] text-[11px] text-slate-500 shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span>
          <span className="text-slate-300">{visibleNodes}</span> nodes
          {topology && topology.nodes.length !== visibleNodes && (
            <span className="text-slate-600"> / {topology.nodes.length}</span>
          )}
        </span>
        <span>
          <span className="text-slate-300">{visibleEdges}</span> edges
          {topology && topology.edges.length !== visibleEdges && (
            <span className="text-slate-600"> / {topology.edges.length}</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {total && (
          <>
            <span>{formatBytes(total.total_bytes)} total</span>
            {total.deny_count > 0 && (
              <span className="text-red-400">{total.deny_count} denied</span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isLoading && <span className="text-cyan-400">refreshing...</span>}
        {lastRefresh && !isLoading && <span>updated {timeAgo(lastRefresh)}</span>}
        <span className="text-slate-600">Press <kbd className="font-mono">?</kbd> for shortcuts</span>
      </div>
    </div>
  )
}
