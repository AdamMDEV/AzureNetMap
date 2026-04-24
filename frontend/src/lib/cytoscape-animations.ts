import type { Core } from 'cytoscape'

export class EdgeAnimator {
  private animId: number | null = null
  private offset = 0
  private enabled: boolean
  private cy: Core

  constructor(cy: Core, enabled: boolean) {
    this.cy = cy
    this.enabled = enabled
  }

  start(edgeCount: number) {
    if (!this.enabled || edgeCount > 2000) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    this.tick()
  }

  private tick = () => {
    if (this.cy.destroyed()) return
    this.offset = (this.offset - 0.5) % 12
    const allowed = this.cy.edges('[flow_type = "Allowed"]')
    if (allowed.length > 0) {
      allowed.style('line-dash-offset', this.offset)
    }
    this.animId = requestAnimationFrame(this.tick)
  }

  stop() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId)
      this.animId = null
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) {
      this.stop()
      // reset offset on all edges
      if (!this.cy.destroyed()) {
        this.cy.edges('[flow_type = "Allowed"]').style('line-dash-offset', 0)
      }
    }
  }
}
