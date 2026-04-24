import cytoscape, { type Core, type ElementDefinition, type ElementsDefinition } from 'cytoscape'
// @ts-expect-error — no bundled types
import coseBilkent from 'cytoscape-cose-bilkent'
// @ts-expect-error — no bundled types
import fcose from 'cytoscape-fcose'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { EdgeData, GroupingMode, LayoutMode, NodeData, TopologyResponse } from '@/types/api'
import { EdgePopup } from './EdgePopup'
import { buildStylesheet } from '@/lib/cytoscape-styles'
import { EdgeAnimator } from '@/lib/cytoscape-animations'

cytoscape.use(coseBilkent)
cytoscape.use(fcose)

function buildElements(
  topology: TopologyResponse,
  grouping: GroupingMode,
): ElementsDefinition {
  const nodes: ElementDefinition[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edges: any[] = []

  if (grouping === 'vnet') {
    for (const vnet of topology.vnets) {
      nodes.push({ data: { id: vnet.id, label: vnet.name, env: vnet.env, isVNet: true } })
    }
    for (const subnet of topology.subnets) {
      nodes.push({
        data: {
          id: subnet.id,
          label: subnet.name,
          env: subnet.env,
          parent: subnet.vnet,
          isSubnet: true,
        },
      })
    }
  } else if (grouping === 'subnet') {
    for (const subnet of topology.subnets) {
      nodes.push({ data: { id: subnet.id, label: subnet.name, env: subnet.env, isSubnet: true } })
    }
  }

  const subnetIds = new Set(topology.subnets.map((s) => s.id))

  for (const { data } of topology.nodes) {
    const nodeData: Record<string, unknown> = { ...data }
    if (grouping !== 'none' && data.subnet && data.env) {
      const subnetId = `${data.env}:${data.subnet}`
      if (subnetIds.has(subnetId)) {
        nodeData.parent = subnetId
      }
    }
    nodes.push({ data: nodeData })
  }

  for (const { data } of topology.edges) {
    edges.push({ data: { ...data } })
  }

  return { nodes, edges }
}

function buildLayout(mode: LayoutMode, hasCompound: boolean) {
  if (mode === 'concentric') {
    return { name: 'concentric', animate: false, padding: 40 }
  }
  if (mode === 'breadthfirst') {
    return { name: 'breadthfirst', animate: false, padding: 40, spacingFactor: 1.5 }
  }
  if (mode === 'grid') {
    return { name: 'grid', animate: false, padding: 40 }
  }
  // fcose (default)
  return {
    name: 'fcose',
    animate: false,
    quality: 'default',
    randomize: true,
    nodeDimensionsIncludeLabels: true,
    uniformNodeDimensions: false,
    packComponents: true,
    sampleSize: 25,
    nodeSeparation: hasCompound ? 50 : 75,
    idealEdgeLength: hasCompound ? 60 : 80,
    edgeElasticity: 0.45,
    nestingFactor: 0.1,
    gravity: 0.25,
    numIter: 2500,
    tile: true,
    tilingPaddingVertical: 10,
    tilingPaddingHorizontal: 10,
  }
}

function updateZoomLabels(cy: Core) {
  const z = cy.zoom()
  const leaves = cy.nodes(':childless')

  if (z < 0.6) {
    leaves.style('label', '')
    return
  }

  if (z < 1.2) {
    const peerCounts = leaves.map((n: cytoscape.NodeSingular) => (n.data('peer_count') as number) || 0)
    const sorted = [...peerCounts].sort((a, b) => b - a)
    const threshold80 = sorted[Math.floor(sorted.length * 0.2)] ?? 0
    leaves.forEach((n) => {
      const pc = (n.data('peer_count') as number) || 0
      n.style('label', pc >= threshold80 ? n.data('label') : '')
    })
    return
  }

  leaves.style('label', 'data(label)')
}

interface Props {
  topology: TopologyResponse | undefined
  onNodeClick: (data: NodeData) => void
  onEdgeClick: (data: EdgeData) => void
  onNodeDblClick: (data: NodeData) => void
  cyRef: React.MutableRefObject<Core | null>
  grouping: GroupingMode
  layout: LayoutMode
  animationsEnabled: boolean
}

export function TopologyGraph({
  topology,
  onNodeClick,
  onEdgeClick,
  onNodeDblClick,
  cyRef,
  grouping,
  layout,
  animationsEnabled,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tippyRef = useRef<TippyInstance | null>(null)
  const animatorRef = useRef<EdgeAnimator | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const nodes = topology?.nodes ?? []
    const edges = topology?.edges ?? []

    const nodeBytes = nodes.map((n) => n.data.bytes_total)
    const edgeBytes = edges.map((e) => e.data.bytes_total)
    const maxNodeBytes = Math.max(0, ...nodeBytes)
    const minNodeBytes = Math.min(0, ...nodeBytes)
    const maxEdgeBytes = Math.max(0, ...edgeBytes)
    const minEdgeBytes = Math.min(0, ...edgeBytes)

    const elements = topology ? buildElements(topology, grouping) : { nodes: [], edges: [] }
    const hasCompound = grouping !== 'none'

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: buildStylesheet(maxNodeBytes, minNodeBytes, maxEdgeBytes, minEdgeBytes),
      layout: buildLayout(layout, hasCompound),
      hideEdgesOnViewport: true,
      boxSelectionEnabled: false,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.04,
      maxZoom: 5,
    })

    cyRef.current = cy

    // smart labels on zoom
    updateZoomLabels(cy)
    cy.on('zoom', () => updateZoomLabels(cy))

    // keep selected + hovered labels always visible
    cy.on('select', 'node', (evt) => {
      evt.target.style('label', evt.target.data('label'))
      evt.target.neighborhood('node:childless').forEach((n: cytoscape.NodeSingular) => {
        n.style('label', n.data('label'))
      })
    })

    // hover class
    cy.on('mouseover', 'node, edge', (evt) => evt.target.addClass('hover'))
    cy.on('mouseout', 'node, edge', (evt) => evt.target.removeClass('hover'))

    // tap node
    cy.on('tap', 'node:childless', (evt) => {
      tippyRef.current?.destroy()
      tippyRef.current = null
      onNodeClick(evt.target.data() as NodeData)
    })

    // double-tap node (focus mode)
    cy.on('dbltap', 'node:childless', (evt) => {
      onNodeDblClick(evt.target.data() as NodeData)
    })

    // double-tap canvas (exit focus / fit)
    cy.on('dbltap', (evt) => {
      if (evt.target === cy) {
        cy.fit(undefined, 40)
      }
    })

    // tap edge
    cy.on('tap', 'edge', (evt) => {
      const edgeData = evt.target.data() as EdgeData
      tippyRef.current?.destroy()

      const container = document.createElement('div')
      const reactRoot = createRoot(container)
      reactRoot.render(<EdgePopup edge={edgeData} />)

      const containerRect = containerRef.current!.getBoundingClientRect()
      const rp = evt.renderedPosition

      const instance = tippy(document.createElement('div'), {
        getReferenceClientRect: () => ({
          width: 0,
          height: 0,
          top: containerRect.top + rp.y,
          bottom: containerRect.top + rp.y,
          left: containerRect.left + rp.x,
          right: containerRect.left + rp.x,
          x: containerRect.left + rp.x,
          y: containerRect.top + rp.y,
          toJSON: () => ({}),
        }),
        appendTo: () => document.body,
        content: container,
        interactive: true,
        trigger: 'manual',
        placement: 'top',
        theme: 'netmap',
        arrow: true,
      })
      instance.show()
      tippyRef.current = instance
      onEdgeClick(edgeData)
    })

    // tap canvas → deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        tippyRef.current?.destroy()
        tippyRef.current = null
      }
    })

    // start animation
    const animator = new EdgeAnimator(cy, animationsEnabled)
    animator.start(edges.length)
    animatorRef.current = animator

    return () => {
      animator.stop()
      tippyRef.current?.destroy()
      cy.destroy()
      cyRef.current = null
      animatorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology, grouping, layout])

  // update animation without rebuilding
  useEffect(() => {
    if (animatorRef.current) {
      animatorRef.current.setEnabled(animationsEnabled)
      if (animationsEnabled) {
        animatorRef.current.start(topology?.edges.length ?? 0)
      }
    }
  }, [animationsEnabled, topology?.edges.length])

  return (
    <div
      ref={containerRef}
      className="cy-container"
      style={{ background: '#0a0e1a' }}
    />
  )
}
