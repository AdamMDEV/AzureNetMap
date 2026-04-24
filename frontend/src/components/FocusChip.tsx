import { X } from 'lucide-react'

interface Props {
  label: string
  onClear: () => void
}

export function FocusChip({ label, onClear }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs animate-fade-in">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      <span>Focused: <span className="font-mono font-medium">{label}</span></span>
      <button
        onClick={onClear}
        className="ml-0.5 text-cyan-400/60 hover:text-cyan-300 transition-colors"
        aria-label="Clear focus"
      >
        <X size={12} />
      </button>
    </div>
  )
}
