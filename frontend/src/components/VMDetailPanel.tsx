import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { fetchVMDetail } from '../api/client'
import type { FirewallHit, FlowRecord, NodeData } from '../types/api'

interface Props {
  node: NodeData
  onClose: () => void
}

type Tab = 'overview' | 'inbound' | 'outbound' | 'firewall'

export function VMDetailPanel({ node, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const vmName = node.vm_name || node.ip

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vm', vmName],
    queryFn: () => fetchVMDetail(vmName),
  })

  return (
    <div className="w-[400px] flex flex-col bg-slate-900 border-l border-slate-700 h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div>
          <div className="text-sm font-medium text-slate-100">{vmName}</div>
          {data?.vm.ip && <div className="text-xs text-slate-400">{data.vm.ip}</div>}
          {data?.vm.vnet && (
            <div className="text-xs text-slate-500">{data.vm.vnet} / {data.vm.subnet}</div>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X size={16} />
        </button>
      </div>

      <div className="flex border-b border-slate-700">
        {(['overview', 'inbound', 'outbound', 'firewall'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'firewall' ? 'FW Hits' : t}
            {t === 'inbound' && data && (
              <span className="ml-1 text-slate-500">({data.inbound.length})</span>
            )}
            {t === 'outbound' && data && (
              <span className="ml-1 text-slate-500">({data.outbound.length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading && <div className="text-xs text-slate-400 text-center py-8">Loading...</div>}
        {isError && (
          <div className="text-xs text-red-400 text-center py-8">Failed to load VM details</div>
        )}
        {data && tab === 'overview' && <OverviewTab node={node} vm={data.vm} inbound={data.inbound} outbound={data.outbound} />}
        {data && tab === 'inbound' && <FlowTable flows={data.inbound} />}
        {data && tab === 'outbound' && <FlowTable flows={data.outbound} />}
        {data && tab === 'firewall' && <FirewallTable hits={data.firewall_hits} />}
      </div>
    </div>
  )
}

function OverviewTab({
  node,
  vm,
  inbound,
  outbound,
}: {
  node: NodeData
  vm: { name: string; ip: string; subnet: string; vnet: string }
  inbound: FlowRecord[]
  outbound: FlowRecord[]
}) {
  function totalBytes(flows: FlowRecord[]): number {
    return flows.reduce((s, f) => s + f.bytes_src_to_dest + f.bytes_dest_to_src, 0)
  }
  function formatBytes(b: number): string {
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
    if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`
    return `${b} B`
  }

  return (
    <div className="space-y-3">
      <Section title="Identity">
        <KV label="Name" value={vm.name || node.label} />
        <KV label="IP" value={vm.ip || node.ip} />
        <KV label="Subnet" value={vm.subnet || node.subnet} />
        <KV label="VNet" value={vm.vnet || node.vnet} />
        <KV label="Env" value={node.env} />
      </Section>
      <Section title="Traffic (24h)">
        <KV label="Inbound flows" value={String(inbound.length)} />
        <KV label="Outbound flows" value={String(outbound.length)} />
        <KV label="Inbound bytes" value={formatBytes(totalBytes(inbound))} />
        <KV label="Outbound bytes" value={formatBytes(totalBytes(outbound))} />
      </Section>
    </div>
  )
}

function FlowTable({ flows }: { flows: FlowRecord[] }) {
  if (!flows.length)
    return <div className="text-xs text-slate-500 text-center py-8">No flows</div>

  return (
    <div className="space-y-1">
      {flows.map((f, i) => (
        <div key={i} className="rounded bg-slate-800 p-2 text-xs space-y-0.5">
          <div className="flex justify-between">
            <span className="text-slate-300">{f.src_ip} → {f.dest_ip}:{f.dest_port}</span>
            <span
              className={`text-xs ${
                f.flow_type === 'Allowed' ? 'text-emerald-400' : f.flow_type === 'Denied' ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              {f.flow_type}
            </span>
          </div>
          <div className="text-slate-500">{f.protocol} · {f.acl_rule}</div>
          <div className="text-slate-600">{new Date(f.time_generated).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

function FirewallTable({ hits }: { hits: FirewallHit[] }) {
  if (!hits.length)
    return <div className="text-xs text-slate-500 text-center py-8">No firewall hits</div>

  return (
    <div className="space-y-1">
      {hits.map((h, i) => (
        <div key={i} className="rounded bg-slate-800 p-2 text-xs space-y-0.5">
          <div className="flex justify-between">
            <span className="text-slate-300">
              {h.source_ip} → {h.destination_ip}:{h.destination_port}
            </span>
            <span className="text-slate-400">{h.hit_count} hits</span>
          </div>
          <div className="text-slate-500">
            {h.rule_type} · {h.protocol}
            {h.actions.length > 0 && ` · ${h.actions.join('/')}`}
          </div>
          {h.rules.length > 0 && (
            <div className="text-slate-600 truncate">{h.rules.slice(0, 2).join(', ')}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 font-mono">{value}</span>
    </div>
  )
}
