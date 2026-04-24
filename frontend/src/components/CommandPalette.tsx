import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Server } from 'lucide-react'
import { fetchSearch } from '@/api/client'
import type { SearchEntry } from '@/types/api'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface Props {
  onSelect: (entry: SearchEntry) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  inputRef?: React.RefObject<HTMLInputElement>
}

export function CommandPalette({ onSelect, open, onOpenChange, inputRef }: Props) {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term), 250)
    return () => clearTimeout(t)
  }, [term])

  const { data } = useQuery({
    queryKey: ['search', debouncedTerm],
    queryFn: () => fetchSearch(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
  })

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onOpenChange])

  if (!open) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        className="flex items-center gap-2 px-3 h-7 rounded-md bg-[#1f2937] border border-[#374151] text-slate-400 text-xs hover:border-[#4b5563] transition-colors min-w-[180px]"
      >
        <span className="flex-1 text-left">Search VM or IP...</span>
        <kbd className="text-[10px] text-slate-600 font-mono bg-[#111827] px-1 rounded">/</kbd>
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative w-72 z-50">
      <Command className="rounded-lg border border-[#1f2937] shadow-2xl" shouldFilter={false}>
        <CommandInput
          ref={inputRef}
          placeholder="Search VM or IP..."
          value={term}
          onValueChange={setTerm}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onOpenChange(false)
              setTerm('')
            }
          }}
        />
        {term.length >= 2 && (
          <CommandList>
            <CommandEmpty>No results for "{term}"</CommandEmpty>
            {data?.results && data.results.length > 0 && (
              <CommandGroup heading="VMs & IPs">
                {data.results.map((entry, i) => (
                  <CommandItem
                    key={i}
                    onSelect={() => {
                      onSelect(entry)
                      onOpenChange(false)
                      setTerm('')
                    }}
                  >
                    <Server className="text-slate-500" />
                    <div>
                      <div className="font-medium">{entry.vm_name || entry.ip}</div>
                      {entry.vnet && (
                        <div className="text-slate-500 text-[10px]">
                          {entry.vnet} / {entry.subnet}
                        </div>
                      )}
                    </div>
                    {entry.ip && (
                      <span className="ml-auto text-slate-600 font-mono text-[10px]">
                        {entry.ip}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  )
}
