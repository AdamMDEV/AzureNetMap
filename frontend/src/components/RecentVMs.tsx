import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRecentVMs } from '@/hooks/useRecentVMs'

export function RecentVMs() {
  const navigate = useNavigate()
  const { recent } = useRecentVMs()

  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600 text-xs text-center">
        <Clock size={18} />
        <span>VMs you view will appear here.</span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[#0f1623]">
      {recent.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between px-4 py-2 text-xs hover:bg-[#111827] cursor-pointer"
          onClick={() => navigate(`/vm/${encodeURIComponent(entry.name)}`)}
        >
          <span className="font-mono text-slate-300 hover:text-cyan-400 transition-colors truncate">
            {entry.name}
          </span>
          <span className="text-slate-600 shrink-0 ml-2">
            {new Date(entry.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
