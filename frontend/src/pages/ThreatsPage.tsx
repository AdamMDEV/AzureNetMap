import { useQuery } from '@tanstack/react-query'
import { Shield, ShieldAlert } from 'lucide-react'
import { fetchThreats } from '@/api/client'
import type { ThreatHit } from '@/types/api'

function ThreatRow({ t }: { t: ThreatHit }) {
  return (
    <div className="bg-[#0d1117] border border-red-900/30 rounded-xl p-4 space-y-1">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-sm text-red-300">{t.ip}</span>
        <span className="text-xs text-slate-500">{t.hit_count} hits</span>
      </div>
      <div className="text-xs text-red-400 font-medium">{t.threat_type}</div>
      {t.threat_description && (
        <div className="text-xs text-slate-500">{t.threat_description}</div>
      )}
      <div className="text-[11px] text-slate-600">
        Last seen: {t.last_seen ? new Date(t.last_seen).toLocaleString() : '—'}
      </div>
    </div>
  )
}

export default function ThreatsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['threats', 24],
    queryFn: () => fetchThreats(24),
    refetchInterval: 60_000,
  })

  const hasThreats = data?.has_threats

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className="flex items-center gap-2 mb-5">
        {hasThreats
          ? <ShieldAlert size={20} className="text-red-400" />
          : <Shield size={20} className="text-emerald-400" />
        }
        <h1 className="text-base font-semibold text-slate-200">Threat Intelligence</h1>
        <span className="text-xs text-slate-600">last 24h</span>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#0d1117] border border-[#1f2937] rounded-xl animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="text-sm text-red-400">Failed to load threat data</div>
      )}

      {data && !isLoading && (
        hasThreats ? (
          <div className="space-y-3">
            <div className="text-xs text-slate-600 mb-2">{data.items.length} threat IP{data.items.length !== 1 ? 's' : ''} detected</div>
            {data.items.map((t, i) => <ThreatRow key={i} t={t} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
            <Shield size={40} className="text-emerald-600" />
            <div className="text-sm">No threat intelligence hits in the last 24h</div>
            <div className="text-xs">Azure NTAIpDetails did not return any ThreatType matches</div>
          </div>
        )
      )}
    </div>
  )
}
