import type { Core } from 'cytoscape'
import { Download } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { TopologyResponse } from '@/types/api'

interface Props {
  cyRef: React.MutableRefObject<Core | null>
  topology: TopologyResponse | undefined
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

export function ExportButton({ cyRef, topology }: Props) {
  function exportPng(selection = false) {
    const cy = cyRef.current
    if (!cy) return
    const selected = cy.$(':selected')
    const opts =
      selection && selected.length > 0 ? { output: 'blob' as const, bg: '#0a0e1a', scale: 2, eles: selected } : { output: 'blob' as const, bg: '#0a0e1a', scale: 2 }
    const blob = cy.png(opts) as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `netmap-${timestamp()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportSvg() {
    const cy = cyRef.current
    if (!cy) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = (cy as any).svg({ bg: '#0a0e1a' }) as string
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `netmap-${timestamp()}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCsv() {
    if (!topology) return
    const rows = ['source_id,source_ip,target_id,target_ip,bytes,flow_type,protocols,ports']
    for (const edge of topology.edges) {
      const d = edge.data
      const src = topology.nodes.find((n) => n.data.id === d.source)
      const tgt = topology.nodes.find((n) => n.data.id === d.target)
      rows.push(
        [
          d.source,
          src?.data.ip ?? '',
          d.target,
          tgt?.data.ip ?? '',
          d.bytes_total,
          d.flow_type,
          d.protocols.join(';'),
          d.dest_ports.join(';'),
        ].join(','),
      )
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `netmap-edges-${timestamp()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Download size={12} />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportPng(false)}>PNG (full graph)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportPng(true)}>PNG (selection)</DropdownMenuItem>
        <DropdownMenuItem onClick={exportSvg}>SVG</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportCsv}>CSV (edges)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
