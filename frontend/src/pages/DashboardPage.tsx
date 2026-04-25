import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowDown, ArrowUp, Clock, Server, Shield, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CountUp from 'react-countup'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fetchDashboardSummary,
  fetchDashboardTimeline,
  fetchExternalDestinations,
  fetchFWLeaders,
  fetchNewVms,
  fetchThreats,
  fetchTopDenied,
  fetchTopTalkers,
} from '@/api/client'
import { formatBytes } from '@/lib/utils'
import type {
  ExternalDestination,
  FWLeader,
  FlowTimelineBucket,
  NewVm,
  ThreatHit,
  TopDeniedSource,
  TopTalker,
} from '@/types/api'
import { PinnedVMs } from '@/components/PinnedVMs'
import { RecentVMs } from '@/components/RecentVMs'

const HOURS = 24

function useDashboard() {
  const summary = useQuery({ queryKey: ['dash-summary', HOURS], queryFn: () => fetchDashboardSummary(HOURS), refetchInterval: 60_000 })
  const talkers = useQuery({ queryKey: ['dash-talkers', HOURS], queryFn: () => fetchTopTalkers(HOURS), refetchInterval: 60_000 })
  const denied = useQuery({ queryKey: ['dash-denied', HOURS], queryFn: () => fetchTopDenied(HOURS), refetchInterval: 60_000 })
  const fw = useQuery({ queryKey: ['dash-fw', HOURS], queryFn: () => fetchFWLeaders(HOURS), refetchInterval: 60_000 })
  const ext = useQuery({ queryKey: ['dash-ext', HOURS], queryFn: () => fetchExternalDestinations(HOURS), refetchInterval: 60_000 })
  const newVms = useQuery({ queryKey: ['dash-new-vms'], queryFn: fetchNewVms, refetchInterval: 60_000 })
  const timeline = useQuery({ queryKey: ['dash-timeline', HOURS], queryFn: () => fetchDashboardTimeline(HOURS), refetchInterval: 60_000 })
  const threats = useQuery({ queryKey: ['dash-threats', HOURS], queryFn: () => fetchThreats(HOURS), refetchInterval: 60_000 })

  const anyLoading = [summary, talkers, denied, fw, ext, newVms, timeline, threats].some(q => q.isLoading)
  const anyError = [summary, talkers, denied, fw, ext, newVms, timeline, threats].some(q => q.isError)

  return { summary, talkers, denied, fw, ext, newVms, timeline, threats, anyLoading, anyError }
}

function Delta({ value }: { value: number | null | undefined }) {
  if (value == null) return null
  const abs = Math.abs(value)
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {value >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {abs}
    </span>
  )
}

function StatCard({
  icon,
  label,
  value,
  delta,
  formatted,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number
  delta?: number | null
  formatted?: string
  accent?: string
}) {
  const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between text-slate-500 text-xs">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        {delta != null && <Delta value={delta} />}
      </div>
      <div className={`text-3xl font-bold tracking-tight ${accent ?? 'text-slate-100'}`}>
        {formatted ?? (
          motionOk
            ? <CountUp end={value} duration={1.2} separator="," />
            : value.toLocaleString()
        )}
      </div>
    </div>
  )
}

function Card({ title, children, className = '' }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0d1117] border border-[#1f2937] rounded-xl flex flex-col ${className}`}>
      <div className="px-4 py-3 border-b border-[#1f2937] text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {title}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600 text-xs">
      <Activity size={20} />
      <span>{msg}</span>
    </div>
  )
}

function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-7 bg-[#111827] rounded animate-pulse" />
      ))}
    </div>
  )
}

function EnvBadge({ env }: { env: string }) {
  const colors: Record<string, string> = {
    prod: 'bg-blue-900/40 text-blue-300',
    dev: 'bg-orange-900/40 text-orange-300',
    hub: 'bg-purple-900/40 text-purple-300',
  }
  const cls = colors[env?.toLowerCase()] ?? 'bg-slate-800 text-slate-400'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{env || '—'}</span>
}

function TopTalkersCard({ data, isLoading, navigate }: { data?: { items: TopTalker[] }; isLoading: boolean; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <Card title="Top Talkers (24h)">
      {isLoading ? <SkeletonRows /> : !data?.items.length ? (
        <EmptyState msg="No traffic in selected range" />
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-600 border-b border-[#1f2937]">
              <th className="text-left px-4 py-2 font-normal">VM</th>
              <th className="text-left px-4 py-2 font-normal">Env</th>
              <th className="text-right px-4 py-2 font-normal">Bytes</th>
              <th className="text-right px-4 py-2 font-normal">Peers</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr
                key={t.vm_name}
                className="border-b border-[#0f1623] hover:bg-[#111827] cursor-pointer transition-colors"
                onClick={() => navigate(`/vm/${encodeURIComponent(t.vm_name)}`)}
              >
                <td className="px-4 py-2 font-mono text-slate-300 truncate max-w-[160px]">{t.vm_name}</td>
                <td className="px-4 py-2"><EnvBadge env={t.environment} /></td>
                <td className="px-4 py-2 text-right text-slate-400">{formatBytes(t.bytes_total)}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.peer_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function TopDeniedCard({ data, isLoading }: { data?: { items: TopDeniedSource[] }; isLoading: boolean }) {
  return (
    <Card title="Top Denied Sources">
      {isLoading ? <SkeletonRows /> : !data?.items.length ? (
        <EmptyState msg="No denied flows" />
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-600 border-b border-[#1f2937]">
              <th className="text-left px-4 py-2 font-normal">Source IP</th>
              <th className="text-right px-4 py-2 font-normal">Denies</th>
              <th className="text-left px-4 py-2 font-normal">Top Dest</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((d) => (
              <tr key={d.src_ip} className="border-b border-[#0f1623] hover:bg-[#111827]">
                <td className="px-4 py-2 font-mono text-slate-300">{d.src_ip}</td>
                <td className="px-4 py-2 text-right text-red-400">{d.denied_count}</td>
                <td className="px-4 py-2 font-mono text-slate-500 truncate max-w-[120px]">{d.top_dest || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function TimelineCard({ data, isLoading }: { data?: { items: FlowTimelineBucket[] }; isLoading: boolean }) {
  const chartData = (data?.items ?? []).map((b) => ({
    time: new Date(b.bucket_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    inbound: Math.round(b.inbound_bytes / 1024),
    outbound: Math.round(b.outbound_bytes / 1024),
    denied: b.denied_count,
  }))

  return (
    <Card title="Flow Volume — 24h (KB)" className="min-h-[200px]">
      {isLoading ? (
        <div className="h-40 bg-[#111827] rounded m-3 animate-pulse" />
      ) : chartData.length === 0 ? (
        <EmptyState msg="No traffic in selected range" />
      ) : (
        <div className="p-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={48} />
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid #1f2937', fontSize: 11 }}
                itemStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="inbound" stroke="#2563eb" fill="url(#inGrad)" strokeWidth={1.5} name="Inbound KB" />
              <Area type="monotone" dataKey="outbound" stroke="#10b981" fill="url(#outGrad)" strokeWidth={1.5} name="Outbound KB" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function FWLeadersCard({ data, isLoading }: { data?: { items: FWLeader[] }; isLoading: boolean }) {
  return (
    <Card title="FW Rule Hit Leaders">
      {isLoading ? <SkeletonRows /> : !data?.items.length ? (
        <EmptyState msg="No firewall data" />
      ) : (
        <div className="divide-y divide-[#0f1623]">
          {data.items.map((f) => (
            <div key={`${f.rule}-${f.hit_count}`} className="px-4 py-2 text-xs flex items-center justify-between gap-2 hover:bg-[#111827]">
              <span className="font-mono text-slate-300 truncate">{f.rule || '(unnamed)'}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-1 py-0.5 rounded text-[10px] ${f.action?.toLowerCase() === 'allow' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                  {f.action}
                </span>
                <span className="text-slate-500">{f.hit_count.toLocaleString()} hits</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ExternalDestCard({ data, isLoading }: { data?: { items: ExternalDestination[] }; isLoading: boolean }) {
  return (
    <Card title="External Destinations">
      {isLoading ? <SkeletonRows /> : !data?.items.length ? (
        <EmptyState msg="No external traffic" />
      ) : (
        <div className="divide-y divide-[#0f1623]">
          {data.items.map((e) => (
            <div key={e.dest_ip} className="px-4 py-2 text-xs flex items-center justify-between hover:bg-[#111827]">
              <span className="font-mono text-slate-300">{e.dest_ip}</span>
              <span className="text-slate-500">{formatBytes(e.bytes_total)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function NewVmsCard({ data, isLoading }: { data?: { items: NewVm[] }; isLoading: boolean }) {
  return (
    <Card title="New VMs Today">
      {isLoading ? <SkeletonRows n={3} /> : !data?.items.length ? (
        <EmptyState msg="No new VMs" />
      ) : (
        <div className="divide-y divide-[#0f1623]">
          {data.items.map((v) => (
            <div key={v.vm_name} className="px-4 py-2 text-xs flex justify-between hover:bg-[#111827]">
              <span className="font-mono text-slate-300 truncate">{v.vm_name}</span>
              <span className="text-slate-600 shrink-0 ml-2">{v.first_seen ? new Date(v.first_seen).toLocaleTimeString() : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ThreatsCard({ data, isLoading }: { data?: { items: ThreatHit[]; has_threats: boolean }; isLoading: boolean }) {
  if (!isLoading && !data?.has_threats) return null

  return (
    <Card title="Threat Hits" className="border-red-900/50">
      {isLoading ? <SkeletonRows n={3} /> : (
        <div className="divide-y divide-[#0f1623]">
          {data!.items.map((t) => (
            <div key={`${t.ip}-${t.threat_type}`} className="px-4 py-2 text-xs space-y-0.5 hover:bg-[#111827]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-red-300">{t.ip}</span>
                <span className="text-slate-500 text-[10px]">{t.hit_count} hits</span>
              </div>
              <div className="text-red-400">{t.threat_type}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { summary, talkers, denied, fw, ext, newVms, timeline, threats } = useDashboard()

  const s = summary.data

  return (
    <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
      {/* Hero stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Server size={12} />}
          label="Active VMs (24h)"
          value={s?.active_vms ?? 0}
          delta={s?.active_vms_delta}
        />
        <StatCard
          icon={<Activity size={12} />}
          label="Total Traffic (24h)"
          value={s?.total_bytes ?? 0}
          formatted={s ? formatBytes(s.total_bytes) : '—'}
          delta={s?.total_bytes_delta}
        />
        <StatCard
          icon={<Shield size={12} />}
          label="Denied Flows (24h)"
          value={s?.denied_flows ?? 0}
          delta={s?.denied_flows_delta}
          accent={s && s.denied_flows > 0 ? 'text-red-400' : undefined}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left 8 cols */}
        <div className="col-span-8 space-y-4">
          <TopTalkersCard data={talkers.data} isLoading={talkers.isLoading} navigate={navigate} />
          <TopDeniedCard data={denied.data} isLoading={denied.isLoading} />
          <TimelineCard data={timeline.data} isLoading={timeline.isLoading} />
        </div>

        {/* Right 4 cols */}
        <div className="col-span-4 space-y-4">
          {/* Pinned VMs */}
          <Card title={<><Star size={11} className="inline mr-1" />Pinned VMs</>}>
            <PinnedVMs />
          </Card>

          {/* Recently viewed */}
          <Card title={<><Clock size={11} className="inline mr-1" />Recently viewed</>}>
            <RecentVMs />
          </Card>

          <ThreatsCard data={threats.data} isLoading={threats.isLoading} />
          <NewVmsCard data={newVms.data} isLoading={newVms.isLoading} />
          <FWLeadersCard data={fw.data} isLoading={fw.isLoading} />
          <ExternalDestCard data={ext.data} isLoading={ext.isLoading} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-600 pb-4">
        <span>Data from last 24h</span>
        <button
          onClick={() => navigate('/map')}
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View full topology map →
        </button>
      </div>
    </div>
  )
}
