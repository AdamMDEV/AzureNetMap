import type { Core } from 'cytoscape'
import { BarChart2, BookOpen, Layers } from 'lucide-react'
import { Legend } from './Legend'
import { Separator } from '@/components/ui/separator'
import { formatBytes, formatNumber } from '@/lib/utils'
import type { TopologyResponse } from '@/types/api'

interface Props {
  cyRef: React.MutableRefObject<Core | null>
  topology: TopologyResponse | undefined
  onPreset: (preset: 'hub-spoke' | 'denied' | 'high-volume') => void
  showUnattributed?: boolean
}

export function LeftSidebar({ topology, onPreset, showUnattributed }: Props) {
  const summary = topology?.summary

  return (
    <div className="w-60 flex flex-col bg-[#0d1117] border-r border-[#1f2937] h-full overflow-y-auto">
      <Section icon={<BookOpen size={12} />} label="Legend">
        <Legend />
      </Section>

      <Separator />

      <Section icon={<Layers size={12} />} label="View Presets">
        <div className="space-y-1.5">
          <PresetButton
            label="Hub-spoke view"
            desc="Hub nodes centered, radial layout"
            onClick={() => onPreset('hub-spoke')}
          />
          <PresetButton
            label="Denied traffic only"
            desc="Show only blocked flows"
            onClick={() => onPreset('denied')}
          />
          <PresetButton
            label="High-volume flows"
            desc="Top 20% by bytes"
            onClick={() => onPreset('high-volume')}
          />
        </div>
      </Section>

      <Separator />

      <Section icon={<BarChart2 size={12} />} label="Statistics">
        {summary ? (
          <div className="space-y-1">
            <Stat label="Nodes" value={formatNumber(topology?.nodes.length ?? 0)} />
            <Stat label="Edges" value={formatNumber(topology?.edges.length ?? 0)} />
            <Stat label="Total bytes" value={formatBytes(summary.total_bytes)} />
            <Stat
              label="Denied edges"
              value={String(summary.deny_count)}
              valueClass={summary.deny_count > 0 ? 'text-red-400' : undefined}
            />
            {showUnattributed && summary.unattributed_count > 0 && (
              <Stat label="Unattributed" value={String(summary.unattributed_count)} valueClass="text-rose-400 font-mono" />
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-600">No data loaded</div>
        )}
      </Section>
    </div>
  )
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}

function PresetButton({
  label,
  desc,
  onClick,
}: {
  label: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[#1f2937] transition-colors group"
    >
      <div className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors">{label}</div>
      <div className="text-[10px] text-slate-600">{desc}</div>
    </button>
  )
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-600">{label}</span>
      <span className={valueClass ?? 'text-slate-300 font-mono'}>{value}</span>
    </div>
  )
}
