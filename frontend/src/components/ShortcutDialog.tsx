import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SHORTCUTS = [
  { key: '/', desc: 'Focus global search' },
  { key: '?', desc: 'Show this dialog' },
  { key: 'g then d', desc: 'Go to Dashboard' },
  { key: 'g then m', desc: 'Go to Map' },
  { key: 'g then t', desc: 'Go to Threats' },
  { key: 'g then r', desc: 'Go to Rules' },
  { key: 'g then c', desc: 'Go to Changelog' },
  { key: 'f', desc: 'Fit graph to viewport (map)' },
  { key: 'Esc', desc: 'Clear selection / exit focus mode' },
  { key: 'd', desc: 'Toggle deny-only filter (map)' },
  { key: 'a', desc: 'Toggle allow-only filter (map)' },
  { key: 'm', desc: 'Toggle minimap (map)' },
  { key: '[', desc: 'Toggle left sidebar (map)' },
  { key: '+', desc: 'Zoom in (map)' },
  { key: '-', desc: 'Zoom out (map)' },
  { key: 'double-click node', desc: 'Enter focus mode (map)' },
]

export function ShortcutDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-1 mt-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between py-1.5 border-b border-[#1f2937] last:border-0">
              <span className="text-xs text-slate-400">{desc}</span>
              <kbd className="font-mono text-[11px] bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded border border-[#374151]">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
