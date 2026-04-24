import { useQuery } from '@tanstack/react-query'
import { Copy, Map, RefreshCw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchVMDetail } from '@/api/client'
import { formatBytes } from '@/lib/utils'
import type { FirewallHit, FlowRecord, HeatmapEntry, PeerEntry, TimelineBucket } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied')).catch(() => {})
}

function EnvBadge({ env }: { env: string }) {
  const variant =
    env === 'prod' ? 'prod' : env === 'dev' ? 'dev' : env === 'hub' ? 'hub' : 'external'
  return <Badge variant={variant as 'prod' | 'dev' | 'hub' | 'external'}>{env}</Badge>
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-semibold ${accent ?? 'text-slate-100'}`}>{value}</div>
    </div>
  )
}

function TimelineChart({ items }: { items: TimelineBucket[] }) {
  if (!items.length) return <div className="text-xs text-slate-600 text-center py-8">No timeline data</div>

  const data = items.map(b => ({
    time: new Date(b.bucket_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    in: Math.round(b.inbound_bytes / 1024),
    out: Math.round(b.outbound_bytes / 1024),
  }))

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="vmInGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="vmOutGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
          <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1f2937', fontSize: 11 }} />
          <Area type="monotone" dataKey="in" stroke="#2563eb" fill="url(#vmInGrad)" strokeWidth={1.5} name="Inbound KB" />
          <Area type="monotone" dataKey="out" stroke="#10b981" fill="url(#vmOutGrad)" strokeWidth={1.5} name="Outbound KB" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function PeersChart({ items }: { items: PeerEntry[] }) {
  if (!items.length) return <div className="text-xs text-slate-600 text-center py-8">No peer data</div>

  const data = items.map(p => ({
    name: p.peer_vm || p.peer_ip,
    bytes: Math.round(p.bytes_total / 1024),
  }))

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={100} />
          <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #1f2937', fontSize: 11 }} />
          <Bar dataKey="bytes" name="KB" radius={[0, 3, 3, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={`hsl(${200 + i * 12}, 70%, 55%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function HeatmapWidget({ items }: { items: HeatmapEntry[] }) {
  if (!items.length) return <div className="text-xs text-slate-600 text-center py-8">No port data</div>

  // Get top 20 ports
  const portMap: Record<string, number[]> = {}
  for (const e of items) {
    if (!portMap[e.port]) portMap[e.port] = new Array(24).fill(0)
    portMap[e.port][e.hour_of_day] = e.flow_count
  }
  const topPorts = Object.entries(portMap)
    .sort((a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0))
    .slice(0, 15)

  const maxVal = Math.max(...topPorts.flatMap(([, vals]) => vals))

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="text-slate-600 font-normal pr-2 text-right">Port</th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="text-slate-600 font-normal w-5 text-center">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topPorts.map(([port, vals]) => (
            <tr key={port}>
              <td className="text-slate-400 font-mono pr-2 text-right py-0.5">{port}</td>
              {vals.map((v, h) => {
                const intensity = maxVal > 0 ? v / maxVal : 0
                const alpha = Math.round(intensity * 200)
                return (
                  <td
                    key={h}
                    className="w-5 h-4"
                    style={{ background: `rgba(37, 99, 235, ${alpha / 255})` }}
                    title={`${port} h${h}: ${v}`}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FlowTable({ flows }: { flows: FlowRecord[] }) {
  if (!flows.length) return <div className="text-xs text-slate-600 text-center py-8">No flows</div>

  return (
    <div className="space-y-1.5">
      {flows.map((f, i) => (
        <div key={i} className="rounded-lg bg-[#111827] border border-[#1f2937] p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-slate-300 truncate">
              {f.src_ip} → {f.dest_ip}{f.dest_port ? `:${f.dest_port}` : ''}
            </span>
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
              f.flow_type === 'Allowed' ? 'bg-emerald-900/40 text-emerald-300'
                : f.flow_type === 'Denied' ? 'bg-red-900/40 text-red-300'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {f.flow_type}
            </span>
          </div>
          <div className="text-slate-500 font-mono">{f.protocol}{f.acl_rule ? ` · ${f.acl_rule}` : ''}</div>
          <div className="text-slate-600">{new Date(f.time_generated).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

function FirewallTable({ hits }: { hits: FirewallHit[] }) {
  if (!hits.length) return <div className="text-xs text-slate-600 text-center py-8">No firewall hits</div>

  return (
    <div className="space-y-1.5">
      {hits.map((h, i) => (
        <div key={i} className="rounded-lg bg-[#111827] border border-[#1f2937] p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-slate-300 truncate">
              {h.source_ip} → {h.destination_ip}{h.destination_port ? `:${h.destination_port}` : ''}
            </span>
            <span className="text-slate-500 shrink-0">{h.hit_count} hits</span>
          </div>
          <div className="text-slate-500">{h.rule_type} · {h.protocol}{h.actions.length > 0 ? ` · ${h.actions.join('/')}` : ''}</div>
          {h.rules.length > 0 && <div className="text-slate-600 font-mono truncate">{h.rules.slice(0, 2).join(', ')}</div>}
        </div>
      ))}
    </div>
  )
}

export default function VMPage() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const vmName = name ? decodeURIComponent(name) : ''

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vm', vmName],
    queryFn: () => fetchVMDetail(vmName),
    enabled: !!vmName,
  })

  if (!vmName) return <div className="p-8 text-slate-500">No VM specified</div>

  const vm = data?.vm
  const inbound = data?.inbound ?? []
  const outbound = data?.outbound ?? []

  function totalBytes(flows: FlowRecord[]) {
    return flows.reduce((s, f) => s + f.bytes_src_to_dest + f.bytes_dest_to_src, 0)
  }

  const denied = [...inbound, ...outbound].filter(f => f.flow_type === 'Denied')
  const denyRate = (inbound.length + outbound.length) > 0
    ? ((denied.length / (inbound.length + outbound.length)) * 100).toFixed(1)
    : '0'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1f2937] shrink-0 bg-[#0d1117]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-100 font-mono truncate">
              {isLoading ? '...' : vm?.name || vmName}
            </h1>
            {vm && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs text-slate-400">{vm.ip}</span>
                <EnvBadge env={(data?.inbound[0]?.src_vm === vm.name ? 'prod' : 'dev')} />
                {vm.subnet && <Badge variant="outline" className="font-mono text-[10px]">{vm.subnet}</Badge>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/map?vm=${encodeURIComponent(vmName)}`)}>
              <Map size={12} /> View on map
            </Button>
            {vm?.ip && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => copy(vm.ip)}>
                <Copy size={12} /> Copy IP
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => copy(vmName)}>
              <Copy size={12} /> Copy name
            </Button>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </div>

      {isError && (
        <div className="px-6 py-2 text-xs text-red-400 bg-red-950/30 border-b border-red-900/30">
          Failed to load VM details
        </div>
      )}

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          Loading VM details...
        </div>
      )}

      {!isLoading && !isError && (
        <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0 rounded-none border-b border-[#1f2937] h-9 bg-transparent justify-start px-6 gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inbound">Inbound <span className="ml-1 text-slate-600">({inbound.length})</span></TabsTrigger>
            <TabsTrigger value="outbound">Outbound <span className="ml-1 text-slate-600">({outbound.length})</span></TabsTrigger>
            <TabsTrigger value="firewall">FW Hits</TabsTrigger>
            {denied.length > 0 && <TabsTrigger value="deny">Denies <span className="ml-1 text-red-600">({denied.length})</span></TabsTrigger>}
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="px-6 py-4 mt-0">
              {/* Stat tiles */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatTile label="Total bytes (24h)" value={formatBytes(totalBytes(inbound) + totalBytes(outbound))} />
                <StatTile label="Peer count" value={String((data?.top_peers ?? []).length)} />
                <StatTile label="Deny rate" value={`${denyRate}%`} accent={parseFloat(denyRate) > 5 ? 'text-red-400' : undefined} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Flow Volume</div>
                  <TimelineChart items={data?.timeline ?? []} />
                </div>
                <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Top Peers (KB)</div>
                  <PeersChart items={data?.top_peers ?? []} />
                </div>
              </div>

              {/* Port heatmap */}
              <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Port Usage Heatmap (hour of day)</div>
                <HeatmapWidget items={data?.port_heatmap ?? []} />
              </div>
            </TabsContent>

            <TabsContent value="inbound" className="px-6 py-4 mt-0">
              <FlowTable flows={inbound} />
            </TabsContent>

            <TabsContent value="outbound" className="px-6 py-4 mt-0">
              <FlowTable flows={outbound} />
            </TabsContent>

            <TabsContent value="firewall" className="px-6 py-4 mt-0">
              <FirewallTable hits={data?.firewall_hits ?? []} />
            </TabsContent>

            {denied.length > 0 && (
              <TabsContent value="deny" className="px-6 py-4 mt-0">
                <div className="mb-4 p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-xs space-y-1">
                  <div className="text-red-300 font-medium">{data?.deny_summary.count} denied flows</div>
                  {data?.deny_summary.top_rules.length ? (
                    <div className="text-red-400">Top rules: {data.deny_summary.top_rules.join(', ')}</div>
                  ) : null}
                  {data?.deny_summary.top_denied_peers.length ? (
                    <div className="text-slate-500">Top peers: {data.deny_summary.top_denied_peers.join(', ')}</div>
                  ) : null}
                </div>
                <FlowTable flows={denied} />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      )}
    </div>
  )
}
