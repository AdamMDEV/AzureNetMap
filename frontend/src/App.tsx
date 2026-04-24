import { useQueryClient } from '@tanstack/react-query'
import type { Core } from 'cytoscape'
import { AlertCircle, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { EdgeData, GroupingMode, LayoutMode, NodeData, SearchEntry } from './types/api'
import { CommandPalette } from './components/CommandPalette'
import { ExportButton } from './components/ExportButton'
import { FocusChip } from './components/FocusChip'
import { LeftSidebar } from './components/LeftSidebar'
import { Minimap } from './components/Minimap'
import { SettingsPopover, type AppSettings } from './components/SettingsPopover'
import { ShortcutDialog } from './components/ShortcutDialog'
import { StatusBar } from './components/StatusBar'
import { TopologyGraph } from './components/TopologyGraph'
import { VMDetailPanel } from './components/VMDetailPanel'
import { ZoomControls } from './components/ZoomControls'
import { Button } from './components/ui/button'
import { TooltipProvider } from './components/ui/tooltip'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useFocusMode } from './hooks/useFocusMode'
import { useTopology } from './hooks/useTopology'

const GROUPINGS: GroupingMode[] = ['none', 'subnet', 'vnet']
const GROUPING_LABELS: Record<GroupingMode, string> = { none: 'Flat', subnet: 'Subnet', vnet: 'VNet' }

const HOUR_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 24, label: '24h' },
  { value: 168, label: '7d' },
  { value: 720, label: '30d' },
]

export default function App() {
  const cyRef = useRef<Core | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { filters, setFilters, topology, isLoading, isError, error, selectedNode, setSelectedNode, setSelectedEdge } =
    useTopology()

  const [grouping, setGrouping] = useState<GroupingMode>('subnet')
  const [layout, setLayout] = useState<LayoutMode>('fcose')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [minimapOpen, setMinimapOpen] = useState(true)
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [settings, setSettings] = useState<AppSettings>({
    animationsEnabled: true,
    showUnattributed: false,
    reducedEffects: false,
  })

  const { focusNodeId, focusNodeLabel, enterFocus, exitFocus } = useFocusMode(cyRef)

  const handleNodeClick = useCallback(
    (data: NodeData) => {
      setSelectedNode(data)
      setSelectedEdge(null)
    },
    [setSelectedNode, setSelectedEdge],
  )

  const handleEdgeClick = useCallback(
    (data: EdgeData) => {
      setSelectedEdge(data)
    },
    [setSelectedEdge],
  )

  const handleNodeDblClick = useCallback(
    (data: NodeData) => {
      enterFocus(data.id, data.vm_name || data.ip)
    },
    [enterFocus],
  )

  const handleSearch = useCallback(
    (entry: SearchEntry) => {
      if (!cyRef.current) return
      const cy = cyRef.current
      const found = cy.nodes().filter((n) => {
        const d = n.data() as NodeData
        return d.vm_name === entry.vm_name || d.ip === entry.ip
      })
      if (found.length > 0) {
        cy.animate({ fit: { eles: found, padding: 80 } }, { duration: 400 })
        found.select()
        setSelectedNode(found.first().data() as NodeData)
      }
    },
    [setSelectedNode],
  )

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['topology'] })
    setLastRefresh(new Date())
  }

  function cycleGrouping() {
    setGrouping((g) => {
      const idx = GROUPINGS.indexOf(g)
      return GROUPINGS[(idx + 1) % GROUPINGS.length]
    })
  }

  function handlePreset(preset: 'hub-spoke' | 'denied' | 'high-volume') {
    if (preset === 'denied') {
      setFilters({ flow_type: 'denied' })
    } else if (preset === 'high-volume') {
      setFilters({ density_threshold: 80 })
    } else if (preset === 'hub-spoke') {
      setGrouping('vnet')
      setLayout('concentric')
      setFilters({ env: 'hub' })
    }
  }

  const handleEscape = useCallback(() => {
    if (focusNodeId) {
      exitFocus()
    } else {
      setSelectedNode(null)
      setSelectedEdge(null)
      cyRef.current?.elements().unselect()
    }
  }, [focusNodeId, exitFocus, setSelectedNode, setSelectedEdge])

  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
    onFit: () => cyRef.current?.fit(undefined, 40),
    onEscape: handleEscape,
    onToggleDeny: () =>
      setFilters({ flow_type: filters.flow_type === 'denied' ? 'all' : 'denied' }),
    onToggleAllow: () =>
      setFilters({ flow_type: filters.flow_type === 'allowed' ? 'all' : 'allowed' }),
    onCycleGrouping: cycleGrouping,
    onToggleMinimap: () => setMinimapOpen((v) => !v),
    onZoomIn: () => {
      const cy = cyRef.current
      if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
    },
    onZoomOut: () => {
      const cy = cyRef.current
      if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
    },
    onHelp: () => setShortcutOpen(true),
    onToggleSidebar: () => setSidebarOpen((v) => !v),
  })

  // sync settings → filters
  const prevShowUnattributed = useRef(settings.showUnattributed)
  if (prevShowUnattributed.current !== settings.showUnattributed) {
    prevShowUnattributed.current = settings.showUnattributed
    setFilters({ include_unattributed: settings.showUnattributed })
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-screen" style={{ background: '#0a0e1a', color: '#f1f5f9' }}>
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 h-12 border-b border-[#1f2937] shrink-0 bg-[#0d1117]">
          {/* Logo */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px #22d3ee' }} />
            <span className="text-sm font-semibold text-slate-100 tracking-tight">AzureNetMap</span>
          </div>

          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
            title="Toggle sidebar ([)"
          >
            {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </Button>

          {/* Search */}
          <CommandPalette
            onSelect={handleSearch}
            open={searchOpen}
            onOpenChange={setSearchOpen}
            inputRef={searchInputRef as React.RefObject<HTMLInputElement>}
          />

          {/* Filter chips */}
          <div className="flex items-center gap-2 ml-2">
            {/* Time range */}
            <div className="flex rounded-md overflow-hidden border border-[#374151]">
              {HOUR_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setFilters({ hours: o.value })}
                  className={`text-xs px-2 py-1 transition-colors ${
                    filters.hours === o.value
                      ? 'bg-[#1f2937] text-slate-100'
                      : 'bg-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {/* Env filter */}
            {(['all', 'prod', 'dev', 'hub'] as const).map((env) => (
              <button
                key={env}
                onClick={() => setFilters({ env })}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  filters.env === env
                    ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                    : 'border-[#374151] text-slate-500 hover:text-slate-300 hover:border-[#4b5563]'
                }`}
              >
                {env === 'all' ? 'All Envs' : env.charAt(0).toUpperCase() + env.slice(1)}
              </button>
            ))}

            {/* Flow filter */}
            {(['all', 'allowed', 'denied'] as const).map((ft) => (
              <button
                key={ft}
                onClick={() => setFilters({ flow_type: ft })}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  filters.flow_type === ft
                    ? ft === 'denied'
                      ? 'border-red-400/50 bg-red-400/10 text-red-300'
                      : ft === 'allowed'
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                        : 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                    : 'border-[#374151] text-slate-500 hover:text-slate-300'
                }`}
              >
                {ft.charAt(0).toUpperCase() + ft.slice(1)}
              </button>
            ))}

            {/* Grouping */}
            <button
              onClick={cycleGrouping}
              className="text-xs px-2.5 py-1 rounded-md border border-[#374151] text-slate-400 hover:text-slate-200 hover:border-[#4b5563] transition-colors"
              title="Cycle grouping (g)"
            >
              {GROUPING_LABELS[grouping]}
            </button>
          </div>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            <ExportButton cyRef={cyRef} topology={topology} />
            <SettingsPopover
              settings={settings}
              onChange={(s) => setSettings((prev) => ({ ...prev, ...s }))}
            />
          </div>
        </header>

        {/* Error bar */}
        {isError && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-red-950/50 border-b border-red-800/50 text-xs text-red-300 shrink-0">
            <AlertCircle size={12} />
            {error instanceof Error ? error.message : 'Failed to load topology'}
          </div>
        )}

        {/* Main body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          {sidebarOpen && (
            <LeftSidebar cyRef={cyRef} topology={topology} onPreset={handlePreset} />
          )}

          {/* Canvas area */}
          <div className="flex-1 relative overflow-hidden">
            {isLoading && !topology && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm z-10">
                Loading topology...
              </div>
            )}

            <TopologyGraph
              topology={topology}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onNodeDblClick={handleNodeDblClick}
              cyRef={cyRef}
              grouping={grouping}
              layout={layout}
              animationsEnabled={settings.animationsEnabled}
            />

            {/* Focus chip */}
            {focusNodeId && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                <FocusChip label={focusNodeLabel} onClear={exitFocus} />
              </div>
            )}

            {/* Zoom controls */}
            <div className="absolute top-3 right-3 z-20">
              <ZoomControls cyRef={cyRef} />
            </div>

            {/* Minimap */}
            <div className="absolute bottom-3 right-3 z-20">
              <Minimap cyRef={cyRef} visible={minimapOpen} />
            </div>
          </div>

          {/* Right panel */}
          {selectedNode && (
            <VMDetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onFocus={(nodeId, label) => {
                enterFocus(nodeId, label)
                setSelectedNode(null)
              }}
            />
          )}
        </div>

        {/* Status bar */}
        <StatusBar
          topology={topology}
          visibleNodes={topology?.nodes.length ?? 0}
          visibleEdges={topology?.edges.length ?? 0}
          lastRefresh={lastRefresh}
          isLoading={isLoading}
        />

        {/* Shortcut dialog */}
        <ShortcutDialog open={shortcutOpen} onOpenChange={setShortcutOpen} />
      </div>
    </TooltipProvider>
  )
}
