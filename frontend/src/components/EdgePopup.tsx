import type { EdgeData } from '../types/api'

interface Props {
  edge: EdgeData
}

function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
  return `${b} B`
}

export function EdgePopup({ edge }: Props) {
  const isAllowed = edge.flow_type === 'Allowed'
  const isDenied = edge.flow_type === 'Denied'

  return (
    <div className="text-xs space-y-1.5 p-0.5">
      <div className="flex items-center gap-2">
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            isAllowed
              ? 'bg-emerald-900/60 text-emerald-300'
              : isDenied
                ? 'bg-red-900/60 text-red-300'
                : 'bg-slate-700 text-slate-300'
          }`}
        >
          {edge.flow_type}
        </span>
        <span className="text-slate-400">{edge.flow_count} flows</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Row label="Volume" value={formatBytes(edge.bytes_total)} />
        <Row label="Packets" value={edge.packets_total.toLocaleString()} />
        {edge.protocols.length > 0 && (
          <Row label="Protocols" value={edge.protocols.join(', ')} />
        )}
        {edge.dest_ports.length > 0 && (
          <Row label="Ports" value={edge.dest_ports.slice(0, 6).join(', ')} />
        )}
      </div>

      {edge.acl_rules.length > 0 && (
        <div>
          <div className="text-slate-500 mb-0.5">ACL Rules</div>
          {edge.acl_rules.slice(0, 4).map((r, i) => (
            <div key={i} className="text-slate-300 truncate">{r}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </>
  )
}
