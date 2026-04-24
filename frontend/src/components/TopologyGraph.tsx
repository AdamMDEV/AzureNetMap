import cytoscape, { type Core, type ElementsDefinition } from 'cytoscape'
// @ts-ignore — no bundled types; registered as Cytoscape extension
import coseBilkent from 'cytoscape-cose-bilkent'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { EdgeData, NodeData, TopologyResponse } from '../types/api'
import { EdgePopup } from './EdgePopup'

cytoscape.use(coseBilkent)

const ENV_COLOR: Record<string, string> = {
  prod: '#3b82f6',
  dev: '#f59e0b',
  hub: '#a855f7',
  external: '#6b7280',
}

function logScale(val: number, minVal: number, maxVal: number, minOut: number, maxOut: number): number {
  if (maxVal <= minVal) return (minOut + maxOut) / 2
  const lMin = Math.log1p(minVal)
  const lMax = Math.log1p(maxVal)
  const lVal = Math.log1p(val)
  if (lMax === lMin) return (minOut + maxOut) / 2
  return minOut + ((lVal - lMin) / (lMax - lMin)) * (maxOut - minOut)
}

function buildStylesheet(
  maxNodeBytes: number,
  minNodeBytes: number,
  maxEdgeBytes: number,
  minEdgeBytes: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
        width: (ele: cytoscape.NodeSingular) =>
          logScale(ele.data('bytes_total') as number, minNodeBytes, maxNodeBytes, 20, 80),
        height: (ele: cytoscape.NodeSingular) =>
          logScale(ele.data('bytes_total') as number, minNodeBytes, maxNodeBytes, 20, 80),
        label: 'data(label)',
        'font-size': '10px',
        'text-valign': 'bottom',
        'text-margin-y': '4px',
        color: '#94a3b8',
        'text-outline-width': 0,
        'border-width': 0,
        'overlay-padding': '4px',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 2,
        'border-color': '#f8fafc',
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? '#ef4444' : '#10b981',
        'target-arrow-color': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? '#ef4444' : '#10b981',
        'target-arrow-shape': 'triangle',
        width: (ele: cytoscape.EdgeSingular) =>
          logScale(ele.data('bytes_total') as number, minEdgeBytes, maxEdgeBytes, 1, 8),
        'curve-style': 'bezier',
        opacity: 0.8,
      },
    },
    {
      selector: 'edge:selected',
      style: {
        opacity: 1,
        'line-color': '#f8fafc',
        'target-arrow-color': '#f8fafc',
      },
    },
  ]
}

interface Props {
  topology: TopologyResponse | undefined
  onNodeClick: (data: NodeData) => void
  onEdgeClick: (data: EdgeData) => void
  cyRef: React.MutableRefObject<Core | null>
}

export function TopologyGraph({ topology, onNodeClick, onEdgeClick, cyRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tippyRef = useRef<TippyInstance | null>(null)

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

    const elements: ElementsDefinition = {
      nodes: nodes.map((n) => ({ data: n.data })),
      edges: edges.map((e) => ({ data: e.data })),
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: buildStylesheet(maxNodeBytes, minNodeBytes, maxEdgeBytes, minEdgeBytes),
      layout: {
        name: 'cose-bilkent',
        animate: false,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 100,
        edgeElasticity: 0.1,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      hideEdgesOnViewport: true,
      boxSelectionEnabled: false,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.05,
      maxZoom: 5,
    })

    cyRef.current = cy

    cy.on('tap', 'node', (evt) => {
      tippyRef.current?.destroy()
      tippyRef.current = null
      onNodeClick(evt.target.data() as NodeData)
    })

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

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        tippyRef.current?.destroy()
        tippyRef.current = null
      }
    })

    return () => {
      tippyRef.current?.destroy()
      cy.destroy()
      cyRef.current = null
    }
  }, [topology])

  return (
    <div
      ref={containerRef}
      className="cy-container"
      style={{ background: '#0f172a' }}
    />
  )
}
