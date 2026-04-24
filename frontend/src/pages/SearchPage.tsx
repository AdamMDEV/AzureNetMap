import { useQuery } from '@tanstack/react-query'
import { Map, Server } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchSearch } from '@/api/client'
import type { SearchEntry } from '@/types/api'

function ResultCard({ entry, navigate }: { entry: SearchEntry; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-4 flex items-center justify-between gap-4 hover:border-[#374151] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Server size={16} className="text-slate-500 shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-sm text-slate-200 truncate">{entry.vm_name || entry.ip}</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">{entry.ip}</div>
          {entry.subnet && <div className="text-[11px] text-slate-600 font-mono">{entry.subnet}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate(`/map?vm=${encodeURIComponent(entry.vm_name || entry.ip)}`)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 border border-[#374151] rounded"
        >
          <Map size={11} />
          Map
        </button>
        {entry.vm_name && (
          <button
            onClick={() => navigate(`/vm/${encodeURIComponent(entry.vm_name)}`)}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 border border-cyan-900/50 rounded"
          >
            Details
          </button>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', q],
    queryFn: () => fetchSearch(q),
    enabled: q.length > 0,
  })

  // Auto-redirect on single exact match
  useEffect(() => {
    if (data?.results.length === 1 && data.results[0].vm_name) {
      const exact = data.results.find(r => r.vm_name === q || r.ip === q)
      if (exact?.vm_name) {
        navigate(`/vm/${encodeURIComponent(exact.vm_name)}`, { replace: true })
      }
    }
  }, [data, q, navigate])

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-slate-500 text-sm gap-2">
        <Server size={32} />
        <span>Enter a search term in the command palette</span>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <h1 className="text-base font-semibold text-slate-300 mb-4">
        Results for: <span className="font-mono text-cyan-400">{q}</span>
      </h1>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[#0d1117] border border-[#1f2937] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-sm text-red-400">Search failed. Try again.</div>
      )}

      {data && !isLoading && (
        <>
          <div className="text-xs text-slate-600 mb-3">{data.results.length} result{data.results.length !== 1 ? 's' : ''}</div>
          {data.results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-2">
              <Server size={24} />
              <span className="text-sm">No results for &ldquo;{q}&rdquo;</span>
            </div>
          ) : (
            <div className="space-y-3">
              {data.results.map((entry, i) => (
                <ResultCard key={i} entry={entry} navigate={navigate} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
