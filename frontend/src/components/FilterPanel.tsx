import type { EnvFilter, FlowFilter, TopologyFilters } from '../types/api'

interface Props {
  filters: TopologyFilters
  onChange: (next: Partial<TopologyFilters>) => void
}

const ENV_OPTIONS: { value: EnvFilter; label: string }[] = [
  { value: 'all', label: 'All Envs' },
  { value: 'prod', label: 'Prod' },
  { value: 'dev', label: 'Dev' },
  { value: 'hub', label: 'Hub' },
]

const FLOW_OPTIONS: { value: FlowFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'allowed', label: 'Allowed' },
  { value: 'denied', label: 'Denied' },
]

const HOUR_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 24, label: '24h' },
  { value: 168, label: '7d' },
  { value: 720, label: '30d' },
]

export function FilterPanel({ filters, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={filters.env}
        onChange={(e) => onChange({ env: e.target.value as EnvFilter })}
        className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200 outline-none hover:border-slate-500"
      >
        {ENV_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <div className="flex rounded overflow-hidden border border-slate-600">
        {FLOW_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange({ flow_type: o.value })}
            className={`text-xs px-2.5 py-1.5 transition-colors ${
              filters.flow_type === o.value
                ? 'bg-slate-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex rounded overflow-hidden border border-slate-600">
        {HOUR_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange({ hours: o.value })}
            className={`text-xs px-2.5 py-1.5 transition-colors ${
              filters.hours === o.value
                ? 'bg-slate-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
