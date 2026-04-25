import { useCallback, useEffect, useState } from 'react'

const KEY = 'anm-recent-vms'
const MAX = 5

interface RecentEntry {
  name: string
  viewed_at: string
}

export function useRecentVMs() {
  const [recent, setRecent] = useState<RecentEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(recent))
  }, [recent])

  const record = useCallback((name: string) => {
    setRecent((prev) => {
      const filtered = prev.filter((e) => e.name !== name)
      return [{ name, viewed_at: new Date().toISOString() }, ...filtered].slice(0, MAX)
    })
  }, [])

  return { recent, record }
}
