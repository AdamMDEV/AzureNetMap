import type { Core } from 'cytoscape'
import { useCallback, useRef, useState } from 'react'

export function useFocusMode(cyRef: React.MutableRefObject<Core | null>) {
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [focusDepth, setFocusDepth] = useState(1)
  const focusNodeLabelRef = useRef<string>('')
  const focusNodeIdRef = useRef<string | null>(null)

  const _applyFocus = useCallback(
    (nodeId: string, depth: number) => {
      const cy = cyRef.current
      if (!cy) return

      const focusNode = cy.$(`#${CSS.escape(nodeId)}`)
      if (focusNode.empty()) return

      // Build subgraph: focused node + N-hop neighbors (leaves only)
      let subgraph = focusNode
      let frontier = focusNode
      for (let i = 0; i < depth; i++) {
        const next = frontier.neighborhood('node:childless').not(subgraph)
        subgraph = subgraph.union(next)
        frontier = next
      }

      // Include edges connecting nodes in the subgraph
      const subgraphEdges = subgraph.edgesWith(subgraph)
      const visible = subgraph.union(subgraphEdges)

      // Hide all elements not in subgraph
      cy.elements().style('display', 'none')
      visible.style('display', 'element')

      // Run concentric layout on visible subgraph
      // Focused node center, neighbors in rings by distance
      const concentricLayout = cy.layout({
        name: 'concentric',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        concentric: (node: any) => {
          if (node.id() === nodeId) return 10
          // Distance from focus node
          const path = cy.elements(':visible').aStar({
            root: `#${CSS.escape(nodeId)}`,
            goal: `#${CSS.escape(node.id())}`,
          })
          return Math.max(0, 10 - (path.distance ?? depth))
        },
        levelWidth: () => 3,
        padding: 60,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-out',
        fit: true,
      })
      concentricLayout.run()
    },
    [cyRef],
  )

  const enterFocus = useCallback(
    (nodeId: string, label: string, depth: number = 1) => {
      const cy = cyRef.current
      if (!cy) return

      focusNodeIdRef.current = nodeId
      focusNodeLabelRef.current = label
      setFocusNodeId(nodeId)
      setFocusDepth(depth)

      _applyFocus(nodeId, depth)
    },
    [cyRef, _applyFocus],
  )

  const setDepth = useCallback(
    (depth: number) => {
      const nodeId = focusNodeIdRef.current
      if (!nodeId) return
      setFocusDepth(depth)
      _applyFocus(nodeId, depth)
    },
    [_applyFocus],
  )

  const exitFocus = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    // Restore all elements
    cy.elements().style('display', 'element')
    // Re-run original layout
    cy.layout({ name: 'fcose', animate: false, padding: 40 } as never).run()
    cy.fit(undefined, 40)
    setFocusNodeId(null)
    setFocusDepth(1)
    focusNodeIdRef.current = null
    focusNodeLabelRef.current = ''
  }, [cyRef])

  return {
    focusNodeId,
    focusDepth,
    focusNodeLabel: focusNodeLabelRef.current,
    enterFocus,
    exitFocus,
    setDepth,
  }
}
