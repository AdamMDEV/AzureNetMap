import type cytoscape from 'cytoscape'

export const ENV_COLOR: Record<string, string> = {
  prod: '#3b82f6',
  dev: '#f59e0b',
  hub: '#a855f7',
  external: '#64748b',
  unattributed: '#f43f5e',
}

export const ENV_GLOW: Record<string, string> = {
  prod: '#60a5fa',
  dev: '#fbbf24',
  hub: '#c084fc',
  external: '#94a3b8',
  unattributed: '#fb7185',
}

export function logScale(
  val: number,
  minVal: number,
  maxVal: number,
  minOut: number,
  maxOut: number,
): number {
  if (maxVal <= minVal) return (minOut + maxOut) / 2
  const lMin = Math.log1p(minVal)
  const lMax = Math.log1p(maxVal)
  const lVal = Math.log1p(val)
  if (lMax === lMin) return (minOut + maxOut) / 2
  return minOut + ((lVal - lMin) / (lMax - lMin)) * (maxOut - minOut)
}

export function buildStylesheet(
  maxNodeBytes: number,
  minNodeBytes: number,
  maxEdgeBytes: number,
  minEdgeBytes: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  return [
    // base node
    {
      selector: 'node',
      style: {
        'background-color': (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
        width: (ele: cytoscape.NodeSingular) =>
          logScale(ele.data('bytes_total') as number, minNodeBytes, maxNodeBytes, 18, 64),
        height: (ele: cytoscape.NodeSingular) =>
          logScale(ele.data('bytes_total') as number, minNodeBytes, maxNodeBytes, 18, 64),
        label: 'data(label)',
        'font-size': '11px',
        'font-family': 'Inter, ui-sans-serif, sans-serif',
        'font-weight': '500',
        'text-valign': 'bottom',
        'text-margin-y': '4px',
        color: '#94a3b8',
        'text-outline-width': 0,
        'border-width': 1.5,
        'border-color': (ele: cytoscape.NodeSingular) =>
          ENV_GLOW[(ele.data('env') as string) || 'external'] ?? ENV_GLOW.external,
        'border-opacity': 0.5,
        'shadow-blur': 6,
        'shadow-color': (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
        'shadow-opacity': 0.35,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'overlay-padding': '6px',
      },
    },
    // leaf nodes only (not compound parents)
    {
      selector: 'node:childless',
      style: {
        shape: 'ellipse',
      },
    },
    // selected node
    {
      selector: 'node:selected',
      style: {
        'border-width': 2.5,
        'border-color': '#22d3ee',
        'border-opacity': 1,
        'shadow-color': '#22d3ee',
        'shadow-blur': 14,
        'shadow-opacity': 0.6,
        color: '#f1f5f9',
      },
    },
    // hovered node
    {
      selector: 'node.hover',
      style: {
        'border-width': 2,
        'border-color': '#e879f9',
        'border-opacity': 1,
        'shadow-color': '#e879f9',
        'shadow-blur': 10,
        'shadow-opacity': 0.5,
      },
    },
    // compound parent (subnet)
    {
      selector: 'node[?isSubnet]',
      style: {
        shape: 'round-rectangle',
        'background-color': (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
        'background-opacity': 0.08,
        'border-width': 1,
        'border-style': 'dashed',
        'border-color': (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
        'border-opacity': 0.4,
        'shadow-blur': 0,
        'shadow-opacity': 0,
        padding: '16px',
        label: 'data(label)',
        'font-size': '10px',
        'font-weight': '600',
        'text-valign': 'top',
        'text-halign': 'left',
        'text-margin-x': '4px',
        'text-margin-y': '4px',
        color: (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
      },
    },
    // compound parent (vnet)
    {
      selector: 'node[?isVNet]',
      style: {
        shape: 'round-rectangle',
        'background-color': (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
        'background-opacity': 0.05,
        'border-width': 2,
        'border-style': 'solid',
        'border-color': (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
        'border-opacity': 0.5,
        'shadow-blur': 0,
        'shadow-opacity': 0,
        padding: '32px',
        label: 'data(label)',
        'font-size': '12px',
        'font-weight': '700',
        'text-valign': 'top',
        'text-halign': 'left',
        'text-margin-x': '6px',
        'text-margin-y': '6px',
        color: (ele: cytoscape.NodeSingular) =>
          ENV_COLOR[(ele.data('env') as string) || 'external'] ?? ENV_COLOR.external,
      },
    },
    // focus-dim: non-focus elements
    {
      selector: '.focus-dim',
      style: {
        opacity: 0.15,
      },
    },
    // focus-context: 2-hop neighbors
    {
      selector: '.focus-context',
      style: {
        opacity: 0.4,
      },
    },
    // base edge
    {
      selector: 'edge',
      style: {
        'line-color': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? '#ef4444' : '#10b981',
        'target-arrow-color': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? '#ef4444' : '#10b981',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.2,
        width: (ele: cytoscape.EdgeSingular) =>
          logScale(ele.data('bytes_total') as number, minEdgeBytes, maxEdgeBytes, 1.5, 8),
        'curve-style': 'bezier',
        opacity: 0.75,
        'line-style': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? 'dashed' : 'solid',
        'line-dash-pattern': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? [6, 4] : [8, 4],
        'line-dash-offset': 0,
      },
    },
    // selected edge
    {
      selector: 'edge:selected',
      style: {
        opacity: 1,
        'line-color': '#22d3ee',
        'target-arrow-color': '#22d3ee',
        width: (ele: cytoscape.EdgeSingular) =>
          logScale(ele.data('bytes_total') as number, minEdgeBytes, maxEdgeBytes, 2.5, 12),
      },
    },
    // hovered edge
    {
      selector: 'edge.hover',
      style: {
        opacity: 1,
        'line-color': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? '#f87171' : '#34d399',
        'target-arrow-color': (ele: cytoscape.EdgeSingular) =>
          (ele.data('flow_type') as string) === 'Denied' ? '#f87171' : '#34d399',
      },
    },
  ]
}
