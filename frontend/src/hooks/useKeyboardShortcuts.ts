import { useEffect } from 'react'

interface Handlers {
  onSearch?: () => void
  onFit?: () => void
  onEscape?: () => void
  onToggleDeny?: () => void
  onToggleAllow?: () => void
  onCycleGrouping?: () => void
  onToggleMinimap?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onHelp?: () => void
  onToggleSidebar?: () => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!target) return false
  const tag = (target as HTMLElement).tagName
  const role = (target as HTMLElement).getAttribute('role')
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (target as HTMLElement).isContentEditable ||
    role === 'textbox' ||
    role === 'combobox'
  )
}

export function useKeyboardShortcuts(handlers: Handlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case '/':
          e.preventDefault()
          handlers.onSearch?.()
          break
        case 'f':
          handlers.onFit?.()
          break
        case 'Escape':
          handlers.onEscape?.()
          break
        case 'd':
          handlers.onToggleDeny?.()
          break
        case 'a':
          handlers.onToggleAllow?.()
          break
        case 'g':
          handlers.onCycleGrouping?.()
          break
        case 'm':
          handlers.onToggleMinimap?.()
          break
        case '+':
        case '=':
          handlers.onZoomIn?.()
          break
        case '-':
          handlers.onZoomOut?.()
          break
        case '?':
          handlers.onHelp?.()
          break
        case '[':
          handlers.onToggleSidebar?.()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
