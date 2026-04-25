import { Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePinnedVMs } from '@/hooks/usePinnedVMs'

export function PinnedVMs() {
  const navigate = useNavigate()
  const { pinned, toggle } = usePinnedVMs()

  if (pinned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600 text-xs text-center">
        <Star size={18} />
        <span>Star any VM to pin it here.</span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[#0f1623]">
      {pinned.map((name) => (
        <div
          key={name}
          className="flex items-center justify-between px-4 py-2 text-xs hover:bg-[#111827] group"
        >
          <button
            className="font-mono text-slate-300 hover:text-cyan-400 transition-colors truncate text-left"
            onClick={() => navigate(`/vm/${encodeURIComponent(name)}`)}
          >
            {name}
          </button>
          <button
            onClick={() => toggle(name)}
            className="ml-2 text-amber-400 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Unpin"
            title="Unpin"
          >
            <Star size={12} className="fill-amber-400" />
          </button>
        </div>
      ))}
    </div>
  )
}
