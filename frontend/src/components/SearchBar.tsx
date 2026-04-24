import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSearch } from '../api/client'
import type { SearchEntry } from '../types/api'

interface Props {
  onSelect: (entry: SearchEntry) => void
}

export function SearchBar({ onSelect }: Props) {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term), 300)
    return () => clearTimeout(t)
  }, [term])

  const { data } = useQuery({
    queryKey: ['search', debouncedTerm],
    queryFn: () => fetchSearch(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
  })

  useEffect(() => {
    setOpen(!!data?.results.length && term.length >= 2)
  }, [data, term])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 border border-slate-600 focus-within:border-blue-500">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search VM or IP..."
          className="bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none w-full"
        />
      </div>
      {open && (
        <ul className="absolute top-full mt-1 w-full rounded border border-slate-600 bg-slate-800 shadow-xl z-50 max-h-60 overflow-auto">
          {data?.results.map((entry, i) => (
            <li
              key={i}
              onClick={() => {
                onSelect(entry)
                setTerm(entry.vm_name || entry.ip)
                setOpen(false)
              }}
              className="px-3 py-2 hover:bg-slate-700 cursor-pointer"
            >
              <div className="text-xs font-medium text-slate-200">{entry.vm_name || entry.ip}</div>
              {entry.vnet && (
                <div className="text-xs text-slate-400">{entry.vnet} / {entry.subnet}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
