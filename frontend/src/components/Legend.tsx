const ENV_ITEMS = [
  { color: '#3b82f6', label: 'Production' },
  { color: '#f59e0b', label: 'Development' },
  { color: '#a855f7', label: 'Hub' },
  { color: '#64748b', label: 'External' },
  { color: '#f43f5e', label: 'Unattributed' },
]

const EDGE_ITEMS = [
  { color: '#10b981', style: 'solid', label: 'Allowed flow' },
  { color: '#ef4444', style: 'dashed', label: 'Denied flow' },
]

export function Legend() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Nodes
        </div>
        <div className="space-y-1.5">
          {ENV_ITEMS.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}80` }}
              />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Edges
        </div>
        <div className="space-y-1.5">
          {EDGE_ITEMS.map(({ color, style, label }) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="24" height="8" className="flex-shrink-0">
                <line
                  x1="0" y1="4" x2="24" y2="4"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray={style === 'dashed' ? '4 3' : undefined}
                />
              </svg>
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Size
        </div>
        <div className="text-xs text-slate-500">Node size ∝ bytes total</div>
        <div className="text-xs text-slate-500">Edge width ∝ bytes total</div>
      </div>
    </div>
  )
}
