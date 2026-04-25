import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DESTINATIONS: Record<string, string> = {
  d: '/',
  m: '/map',
  t: '/threats',
  r: '/rules',
  c: '/changelog',
}

function isTyping(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable ||
    el.getAttribute('role') === 'textbox' ||
    el.getAttribute('role') === 'combobox'
  )
}

export function useGlobalKeyNav(onSearch: () => void) {
  const navigate = useNavigate()
  const [gPressed, setGPressed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (gPressed) {
        const dest = DESTINATIONS[e.key]
        if (dest) {
          e.preventDefault()
          navigate(dest)
        }
        setGPressed(false)
        if (timerRef.current) clearTimeout(timerRef.current)
        return
      }

      if (e.key === 'g') {
        setGPressed(true)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setGPressed(false), 1000)
        return
      }

      if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        onSearch()
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [gPressed, navigate, onSearch])

  return { gPressed }
}
