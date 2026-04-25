import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, HelpCircle, Menu, Network } from 'lucide-react'
import { CommandPalette } from './CommandPalette'
import { SettingsPopover, type AppSettings } from './SettingsPopover'
import { Button } from './ui/button'
import type { SearchEntry } from '@/types/api'
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet'

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.3.0'
const VERSION_SEEN_KEY = 'anm-version-seen'

interface NavTab {
  label: string
  path: string
  key: string
}

const NAV_TABS: NavTab[] = [
  { label: 'Dashboard', path: '/', key: 'dashboard' },
  { label: 'Map', path: '/map', key: 'map' },
  { label: 'Threats', path: '/threats', key: 'threats' },
  { label: 'Rules', path: '/rules', key: 'rules' },
]

function useSecondaryBreadcrumbs(): { label: string; href?: string }[] {
  const loc = useLocation()
  const path = loc.pathname
  if (path.startsWith('/vm/')) {
    const name = decodeURIComponent(path.slice(4))
    return [{ label: 'Map', href: '/map' }, { label: name }]
  }
  if (path === '/changelog') return [{ label: 'Changelog' }]
  if (path.startsWith('/rules/')) return [{ label: 'Rules', href: '/rules' }, { label: path.includes('/new') ? 'New Rule' : 'Edit Rule' }]
  return []
}

function VersionBadge() {
  return (
    <Link
      to="/changelog"
      className="text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-500 hover:text-cyan-300 hover:border-cyan-400/40 transition-colors font-mono"
      title={`v${APP_VERSION} — click to see what's new`}
    >
      v{APP_VERSION}
    </Link>
  )
}

function NavTabs({ onClose }: { onClose?: () => void }) {
  const location = useLocation()
  const currentPath = location.pathname

  function isActive(tab: NavTab) {
    if (tab.path === '/') return currentPath === '/'
    return currentPath.startsWith(tab.path)
  }

  return (
    <>
      {NAV_TABS.map((tab) => {
        const active = isActive(tab)
        return (
          <Link
            key={tab.key}
            to={tab.path}
            onClick={onClose}
            className={`relative text-sm px-3 py-1 transition-colors ${
              active ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-t"
                style={{ bottom: '-1px' }}
              />
            )}
          </Link>
        )
      })}
    </>
  )
}

interface Props {
  settings: AppSettings
  onSettingsChange: (s: Partial<AppSettings>) => void
  onHelpOpen: () => void
  searchOpen: boolean
  onSearchOpenChange: (v: boolean) => void
}

export function TopNav({ settings, onSettingsChange, onHelpOpen, searchOpen, onSearchOpenChange }: Props) {
  const navigate = useNavigate()
  const breadcrumbs = useSecondaryBreadcrumbs()

  function handleSearchSelect(entry: SearchEntry) {
    onSearchOpenChange(false)
    if (entry.vm_name) navigate(`/vm/${encodeURIComponent(entry.vm_name)}`)
  }

  return (
    <header className="shrink-0 border-b border-[#1f2937] bg-[#0c1220]">
      {/* Primary nav row */}
      <div className="flex items-center gap-3 px-4 h-[52px]">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity"
          aria-label="AzureNetMap home"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px #22d3ee' }} />
          <Network size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-slate-100 tracking-tight">AzureNetMap</span>
        </Link>
        <VersionBadge />

        {/* Primary nav tabs — desktop */}
        <nav className="hidden md:flex items-center gap-1 h-full relative ml-4" aria-label="Main navigation">
          <NavTabs />
        </nav>

        <div className="flex-1" />

        {/* Search */}
        <div className="hidden md:flex w-[280px]">
          <CommandPalette
            onSelect={handleSearchSelect}
            open={searchOpen}
            onOpenChange={onSearchOpenChange}
            inputRef={{ current: null }}
          />
        </div>

        {/* Settings + Help */}
        <div className="flex items-center gap-1">
          <SettingsPopover
            settings={settings}
            onChange={(s) => onSettingsChange(s)}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onHelpOpen}
            aria-label="Keyboard shortcuts (?)"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle size={14} className="text-slate-500" />
          </Button>

          {/* Mobile hamburger */}
          <MobileMenu />
        </div>
      </div>

      {/* Secondary breadcrumbs row */}
      {breadcrumbs.length > 0 && (
        <nav
          className="flex items-center gap-1 px-4 h-9 text-xs text-slate-500 border-t border-[#1a2030]"
          aria-label="Breadcrumbs"
        >
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
      )}
    </header>
  )
}

function MobileMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu size={16} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-[#0c1220] border-[#1f2937] w-64 p-0">
          <div className="flex flex-col gap-1 p-4 pt-6">
            <NavTabs onClose={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export { APP_VERSION, VERSION_SEEN_KEY }
