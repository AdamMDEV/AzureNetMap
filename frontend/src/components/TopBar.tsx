import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ChevronRight, Network, ShieldAlert } from 'lucide-react'
import { CommandPalette } from './CommandPalette'
import type { SearchEntry } from '@/types/api'

function useBreadcrumbs(): { label: string; href?: string }[] {
  const loc = useLocation()
  const path = loc.pathname

  if (path === '/') return [{ label: 'Dashboard' }]
  if (path === '/map') return [{ label: 'Dashboard', href: '/' }, { label: 'Map' }]
  if (path.startsWith('/vm/')) {
    const name = decodeURIComponent(path.slice(4))
    return [
      { label: 'Dashboard', href: '/' },
      { label: 'Map', href: '/map' },
      { label: name },
    ]
  }
  if (path === '/search') return [{ label: 'Dashboard', href: '/' }, { label: 'Search' }]
  if (path === '/threats') return [{ label: 'Dashboard', href: '/' }, { label: 'Threats' }]
  return [{ label: 'Dashboard', href: '/' }]
}

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const breadcrumbs = useBreadcrumbs()
  const [searchOpen, setSearchOpen] = useState(false)

  const isMap = location.pathname === '/map'

  function handleSearchSelect(entry: SearchEntry) {
    setSearchOpen(false)
    if (entry.vm_name) {
      navigate(`/vm/${encodeURIComponent(entry.vm_name)}`)
    }
  }

  return (
    <header className="flex items-center gap-3 px-4 h-12 border-b border-[#1f2937] shrink-0 bg-[#0d1117]">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity">
        <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px #22d3ee' }} />
        <Network size={14} className="text-cyan-400" />
        <span className="text-sm font-semibold text-slate-100 tracking-tight">AzureNetMap</span>
      </Link>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={10} className="text-slate-700" />}
            {crumb.href ? (
              <Link to={crumb.href} className="hover:text-slate-300 transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-slate-300">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Center: command palette */}
      <div className="flex-1 flex justify-center max-w-sm mx-auto">
        <CommandPalette
          onSelect={handleSearchSelect}
          open={searchOpen}
          onOpenChange={setSearchOpen}
          inputRef={{ current: null }}
        />
      </div>

      {/* Right: threats indicator */}
      <div className="flex items-center gap-2">
        <Link
          to="/threats"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded"
        >
          <ShieldAlert size={13} />
          Threats
        </Link>
        {!isMap && (
          <Link
            to="/map"
            className="text-xs px-2.5 py-1 rounded-md border border-[#374151] text-slate-400 hover:text-slate-200 hover:border-[#4b5563] transition-colors"
          >
            Open Map
          </Link>
        )}
      </div>
    </header>
  )
}
