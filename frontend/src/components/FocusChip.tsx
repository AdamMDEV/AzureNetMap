import { X } from 'lucide-react'

interface Props {
  label: string
  depth: number
  onDepthChange: (d: number) => void
  onClear: () => void
}

export function FocusChip({ label, depth, onDepthChange, onClear }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs animate-fade-in shadow-lg">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
      <span className="font-mono font-medium truncate max-w-[160px]">{label}</span>

      {/* Depth selector */}
      <div className="flex rounded overflow-hidden border border-cyan-400/20 text-[10px]">
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            onClick={() => onDepthChange(d)}
            className={`px-2 py-0.5 transition-colors ${
              depth === d
                ? 'bg-cyan-400/20 text-cyan-200'
                : 'text-cyan-500 hover:text-cyan-300'
            }`}
            aria-label={`${d} hop${d !== 1 ? 's' : ''}`}
          >
            {d}
          </button>
        ))}
      </div>
      <span className="text-cyan-500 text-[10px]">hop{depth !== 1 ? 's' : ''}</span>

      <button
        onClick={onClear}
        className="ml-0.5 text-cyan-400/60 hover:text-cyan-300 transition-colors"
        aria-label="Exit focus mode"
      >
        <X size={12} />
      </button>
    </div>
  )
}
