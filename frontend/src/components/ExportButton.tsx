import { Download } from 'lucide-react'
import type { Core } from 'cytoscape'

interface Props {
  cyRef: React.MutableRefObject<Core | null>
}

export function ExportButton({ cyRef }: Props) {
  function handleExport() {
    const cy = cyRef.current
    if (!cy) return
    const blob = cy.png({ output: 'blob', bg: '#0f172a', scale: 2 }) as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `netmap-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      title="Export as PNG"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition-colors"
    >
      <Download size={14} />
      Export
    </button>
  )
}
