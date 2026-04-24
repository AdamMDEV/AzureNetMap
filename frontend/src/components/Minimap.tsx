import type { Core } from 'cytoscape'
import { useEffect, useRef, useState } from 'react'

interface Props {
  cyRef: React.MutableRefObject<Core | null>
  visible: boolean
}

export function Minimap({ cyRef, visible }: Props) {
  const [snapshot, setSnapshot] = useState<string>('')
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (!visible) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const capture = () => {
      const cy = cyRef.current
      if (!cy || cy.destroyed()) return
      try {
        const png = cy.png({ output: 'base64uri', bg: '#0a0e1a', scale: 0.15 })
        setSnapshot(png as string)
      } catch {
        // ignore
      }
    }

    capture()
    intervalRef.current = window.setInterval(capture, 3000)
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [visible, cyRef])

  if (!visible) return null

  return (
    <div className="rounded-lg border border-[#1f2937] overflow-hidden bg-[#0a0e1a] shadow-2xl"
      style={{ width: 200, height: 150 }}>
      {snapshot ? (
        <img src={snapshot} alt="Minimap" className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs">
          Loading...
        </div>
      )}
    </div>
  )
}
