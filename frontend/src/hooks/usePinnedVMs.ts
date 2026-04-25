import { useCallback, useEffect, useState } from 'react'

const KEY = 'anm-pinned-vms'
const MAX = 10

export function usePinnedVMs() {
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(pinned))
  }, [pinned])

  const isPinned = useCallback((name: string) => pinned.includes(name), [pinned])

  const toggle = useCallback((name: string) => {
    setPinned((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name)
      return [name, ...prev].slice(0, MAX)
    })
  }, [])

  return { pinned, isPinned, toggle }
}
