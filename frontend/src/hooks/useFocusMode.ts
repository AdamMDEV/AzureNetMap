import type { Core } from 'cytoscape'
import { useCallback, useRef, useState } from 'react'

export function useFocusMode(cyRef: React.MutableRefObject<Core | null>) {
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const focusNodeLabel = useRef<string>('')

  const enterFocus = useCallback(
    (nodeId: string, label: string) => {
      const cy = cyRef.current
      if (!cy) return

      setFocusNodeId(nodeId)
      focusNodeLabel.current = label

      const focusNode = cy.$(`#${CSS.escape(nodeId)}`)
      if (focusNode.empty()) return

      const depth1 = focusNode.neighborhood('node')
      const depth2 = depth1.neighborhood('node').not(focusNode).not(depth1)

      cy.elements().addClass('focus-dim')
      cy.edges().addClass('focus-dim')

      focusNode.removeClass('focus-dim')
      depth1.removeClass('focus-dim')
      focusNode.connectedEdges().removeClass('focus-dim')
      depth1.connectedEdges().removeClass('focus-dim')

      depth2.removeClass('focus-dim').addClass('focus-context')

      // hide depth 3+
      cy.nodes()
        .not(focusNode)
        .not(depth1)
        .not(depth2)
        .not('[?isSubnet]')
        .not('[?isVNet]')
        .addClass('focus-dim')

      cy.animate(
        { fit: { eles: focusNode.union(depth1), padding: 80 } },
        { duration: 400 },
      )
    },
    [cyRef],
  )

  const exitFocus = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('focus-dim focus-context')
    setFocusNodeId(null)
    focusNodeLabel.current = ''
  }, [cyRef])

  return {
    focusNodeId,
    focusNodeLabel: focusNodeLabel.current,
    enterFocus,
    exitFocus,
  }
}
