import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, Plus, Target, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchVMDetail } from '@/api/client'
import type { FirewallHit, FlowRecord, NodeData } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatBytes } from '@/lib/utils'

interface Props {
  node: NodeData
  onClose: () => void
  onFocus: (nodeId: string, label: string) => void
  onViewDetail?: (vmName: string) => void
}

type EnvVariant = 'prod' | 'dev' | 'hub' | 'external' | 'allowed' | 'denied' | 'secondary' | 'outline' | 'default' | 'destructive'

function envVariant(env: string): EnvVariant {
  if (env === 'prod') return 'prod'
  if (env === 'dev') return 'dev'
  if (env === 'hub') return 'hub'
  return 'external'
}

export function VMDetailPanel({ node, onClose, onFocus, onViewDetail }: Props) {
  const vmName = node.vm_name || node.ip
  const navigate = useNavigate()
  const [addRuleOpen, setAddRuleOpen] = useState(false)
  const [ruleDirection, setRuleDirection] = useState<'source' | 'destination' | 'either'>('destination')
  const [ruleType, setRuleType] = useState<'nsg' | 'firewall'>('nsg')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vm', vmName],
    queryFn: () => fetchVMDetail(vmName),
  })

  const copy = (text: string) => navigator.clipboard.writeText(text).catch(() => undefined)

  return (
    <div className="w-[420px] flex flex-col bg-[#0d1117] border-l border-[#1f2937] h-full animate-slide-in-right">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f2937] shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-slate-100 tracking-tight truncate">
              {vmName}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-mono text-xs text-slate-400">{node.ip}</span>
              <Badge variant={envVariant(node.env)}>{node.env}</Badge>
              {node.subnet && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {node.subnet}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 mt-0.5">
            <X size={14} />
          </Button>
        </div>

        <div className="flex gap-2 mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-6 px-2 text-slate-400"
            onClick={() => copy(node.ip)}
          >
            <Copy size={10} />
            Copy IP
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-6 px-2 text-slate-400"
            onClick={() => copy(vmName)}
          >
            <Copy size={10} />
            Copy name
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-6 px-2 text-cyan-400 hover:text-cyan-300"
            onClick={() => onFocus(node.id, vmName)}
          >
            <Target size={10} />
            Focus
          </Button>
          {onViewDetail && node.vm_name && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] h-6 px-2 text-slate-400 hover:text-slate-200"
              onClick={() => onViewDetail(node.vm_name)}
            >
              <ExternalLink size={10} />
              Full detail
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] h-6 px-2 text-slate-400 hover:text-slate-200"
            onClick={() => setAddRuleOpen(true)}
            title="Add NSG or firewall rule"
          >
            <Plus size={10} />
            Add rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
        <TabsList className="shrink-0 rounded-none border-b border-[#1f2937] h-9 bg-transparent justify-start px-4 gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inbound">
            Inbound {data && <span className="ml-1 text-slate-600">({data.inbound.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="outbound">
            Outbound {data && <span className="ml-1 text-slate-600">({data.outbound.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="firewall">FW Hits</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {isLoading && (
            <div className="text-xs text-slate-500 text-center py-12">Loading...</div>
          )}
          {isError && (
            <div className="text-xs text-red-400 text-center py-12">Failed to load details</div>
          )}

          {data && (
            <>
              <TabsContent value="overview" className="px-4 py-3 mt-0">
                <OverviewTab node={node} vm={data.vm} inbound={data.inbound} outbound={data.outbound} />
              </TabsContent>
              <TabsContent value="inbound" className="px-4 py-3 mt-0">
                <FlowTable flows={data.inbound} />
              </TabsContent>
              <TabsContent value="outbound" className="px-4 py-3 mt-0">
                <FlowTable flows={data.outbound} />
              </TabsContent>
              <TabsContent value="firewall" className="px-4 py-3 mt-0">
                <FirewallTable hits={data.firewall_hits} />
              </TabsContent>
            </>
          )}
        </ScrollArea>
      </Tabs>
      {/* Add Rule mini-dialog */}
      <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
        <DialogContent className="bg-[#0d1117] border-[#1f2937] max-w-xs">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-200">Add rule for {vmName}</h3>
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500">This VM is the:</div>
              {(['source', 'destination', 'either'] as const).map((d) => (
                <label key={d} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input type="radio" value={d} checked={ruleDirection === d} onChange={() => setRuleDirection(d)} className="accent-cyan-400" />
                  {d === 'source' ? 'Source' : d === 'destination' ? 'Destination' : 'Either'}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500">Rule type:</div>
              {(['nsg', 'firewall'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input type="radio" value={t} checked={ruleType === t} onChange={() => setRuleType(t)} className="accent-cyan-400" />
                  {t === 'nsg' ? 'NSG rule' : 'Firewall rule'}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 text-[11px] bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/20"
                onClick={() => {
                  setAddRuleOpen(false)
                  navigate(`/rules/new?vm=${encodeURIComponent(vmName)}&direction=${ruleDirection}&type=${ruleType}`)
                }}
              >
                Continue
              </Button>
              <Button size="sm" variant="ghost" className="text-[11px] text-slate-500" onClick={() => setAddRuleOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  function totalBytes(flows: FlowRecord[]) {
    return flows.reduce((s, f) => s + f.bytes_src_to_dest + f.bytes_dest_to_src, 0)
  }

  const denyInbound = inbound.filter((f) => f.flow_type === 'Denied').length
  const denyOutbound = outbound.filter((f) => f.flow_type === 'Denied').length
  const denyRate =
    inbound.length + outbound.length > 0
      ? (((denyInbound + denyOutbound) / (inbound.length + outbound.length)) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-4">
      <Section title="Identity">
        <KV label="Name" value={vm.name || node.label} mono />
        <KV label="IP" value={vm.ip || node.ip} mono />
        <KV label="Subnet" value={vm.subnet || node.subnet} mono />
        <KV label="VNet" value={vm.vnet || node.vnet} />
        <KV label="Env" value={node.env} />
        <KV label="Peers" value={String(node.peer_count)} />
      </Section>
      <Section title="Traffic (24h)">
        <KV label="Inbound flows" value={String(inbound.length)} />
        <KV label="Outbound flows" value={String(outbound.length)} />
        <KV label="Inbound bytes" value={formatBytes(totalBytes(inbound))} />
        <KV label="Outbound bytes" value={formatBytes(totalBytes(outbound))} />
        <KV label="Deny rate" value={`${denyRate}%`} valueClass={parseFloat(denyRate) > 5 ? 'text-red-400' : undefined} />
      </Section>
    </div>
  )
}

function FlowTable({ flows }: { flows: FlowRecord[] }) {
  if (!flows.length)
    return <div className="text-xs text-slate-600 text-center py-8">No flows</div>

  return (
    <div className="space-y-1.5">
      {flows.map((f, i) => (
        <div key={i} className="rounded-lg bg-[#111827] border border-[#1f2937] p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-slate-300 truncate">
              {f.src_ip} → {f.dest_ip}
              {f.dest_port ? `:${f.dest_port}` : ''}
            </span>
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                f.flow_type === 'Allowed'
                  ? 'bg-emerald-900/40 text-emerald-300'
                  : f.flow_type === 'Denied'
                    ? 'bg-red-900/40 text-red-300'
                    : 'bg-slate-800 text-slate-400'
              }`}
            >
              {f.flow_type}
            </span>
          </div>
          <div className="text-slate-500 font-mono">
            {f.protocol}
            {f.acl_rule ? ` · ${f.acl_rule}` : ''}
          </div>
          <div className="text-slate-600">{new Date(f.time_generated).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

function FirewallTable({ hits }: { hits: FirewallHit[] }) {
  if (!hits.length)
    return <div className="text-xs text-slate-600 text-center py-8">No firewall hits</div>

  return (
    <div className="space-y-1.5">
      {hits.map((h, i) => (
        <div key={i} className="rounded-lg bg-[#111827] border border-[#1f2937] p-2.5 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-slate-300 truncate">
              {h.source_ip} → {h.destination_ip}
              {h.destination_port ? `:${h.destination_port}` : ''}
            </span>
            <span className="text-slate-500 shrink-0">{h.hit_count} hits</span>
          </div>
          <div className="text-slate-500">
            {h.rule_type} · {h.protocol}
            {h.actions.length > 0 ? ` · ${h.actions.join('/')}` : ''}
          </div>
          {h.rules.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {h.rules.slice(0, 3).map((r) => (
                <span key={r} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">{r}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function KV({
  label,
  value,
  mono = false,
  valueClass,
}: {
  label: string
  value: string
  mono?: boolean
  valueClass?: string
}) {
  if (!value) return null
  return (
    <div className="flex justify-between text-xs gap-4">
      <span className="text-slate-600 shrink-0">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${valueClass ?? 'text-slate-300'} text-right truncate`}>
        {value}
      </span>
    </div>
  )
}
