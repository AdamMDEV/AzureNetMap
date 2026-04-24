import type { Core } from 'cytoscape'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  cyRef: React.MutableRefObject<Core | null>
}

export function ZoomControls({ cyRef }: Props) {
  function zoomIn() {
    const cy = cyRef.current
    if (!cy) return
    cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
  }
  function zoomOut() {
    const cy = cyRef.current
    if (!cy) return
    cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
  }
  function fit() {
    cyRef.current?.fit(undefined, 40)
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" size="icon" onClick={zoomIn} title="Zoom in (+)">
        <Plus size={12} />
      </Button>
      <Button variant="secondary" size="icon" onClick={zoomOut} title="Zoom out (-)">
        <Minus size={12} />
      </Button>
      <Button variant="secondary" size="icon" onClick={fit} title="Fit (f)">
        <Maximize2 size={12} />
      </Button>
    </div>
  )
}
