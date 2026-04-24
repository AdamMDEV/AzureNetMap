import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

export interface AppSettings {
  animationsEnabled: boolean
  showUnattributed: boolean
  reducedEffects: boolean
}

interface Props {
  settings: AppSettings
  onChange: (s: Partial<AppSettings>) => void
}

export function SettingsPopover({ settings, onChange }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="text-xs font-semibold text-slate-300 mb-3">Settings</div>
        <div className="space-y-3">
          <Row
            label="Show unattributed flows"
            desc="IPs without VM names"
            checked={settings.showUnattributed}
            onCheckedChange={(v) => onChange({ showUnattributed: v })}
          />
          <Separator />
          <Row
            label="Edge animations"
            desc="Animated flow direction"
            checked={settings.animationsEnabled}
            onCheckedChange={(v) => onChange({ animationsEnabled: v })}
          />
          <Row
            label="Reduce visual effects"
            desc="Disable glow and shadows"
            checked={settings.reducedEffects}
            onCheckedChange={(v) => onChange({ reducedEffects: v })}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Row({
  label,
  desc,
  checked,
  onCheckedChange,
}: {
  label: string
  desc: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs text-slate-200">{label}</div>
        <div className="text-[10px] text-slate-500">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
