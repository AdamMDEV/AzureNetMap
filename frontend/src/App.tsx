import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { TooltipProvider } from './components/ui/tooltip'
import { TopNav } from './components/TopNav'
import { ShortcutDialog } from './components/ShortcutDialog'
import { Toaster } from 'sonner'
import { useGlobalKeyNav } from './hooks/useGlobalKeyNav'
import { useVersionToast } from './hooks/useVersionToast'
import type { AppSettings } from './components/SettingsPopover'

const MapPage = lazy(() => import('./pages/MapPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const VMPage = lazy(() => import('./pages/VMPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ThreatsPage = lazy(() => import('./pages/ThreatsPage'))
const RulesPage = lazy(() => import('./pages/RulesPage'))
const RuleFormPage = lazy(() => import('./pages/RuleFormPage'))
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))

NProgress.configure({ showSpinner: false, trickleSpeed: 200, minimum: 0.15 })

function PageLoader() {
  useEffect(() => {
    NProgress.start()
    return () => { NProgress.done() }
  }, [])
  return (
    <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
      <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
    </div>
  )
}

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const pageVariants = {
  initial: reducedMotion ? {} : { opacity: 0, y: 4 },
  animate: reducedMotion ? {} : { opacity: 1, y: 0 },
  exit: reducedMotion ? {} : { opacity: 0 },
}

const pageTransition = { duration: reducedMotion ? 0 : 0.15 }

function AnimatedRoutes({ settings }: { settings: AppSettings }) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/map" element={<MapPage settings={settings} />} />
            <Route path="/vm/:name" element={<VMPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/threats" element={<ThreatsPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/rules/new" element={<RuleFormPage />} />
            <Route path="/rules/:id/edit" element={<RuleFormPage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

function AppInner() {
  const navigate = useNavigate()
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({
    animationsEnabled: true,
    showUnattributed: false,
    reducedEffects: false,
  })

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const { gPressed } = useGlobalKeyNav(openSearch)

  useVersionToast(() => navigate('/changelog'))

  // global ? shortcut for help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing =
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      if (typing) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') setShortcutOpen(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-screen" style={{ background: '#0a0e1a', color: '#f1f5f9' }}>
        <TopNav
          settings={settings}
          onSettingsChange={(s) => setSettings((prev) => ({ ...prev, ...s }))}
          onHelpOpen={() => setShortcutOpen(true)}
          searchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
        />

        {/* g-key hint */}
        {gPressed && (
          <div className="fixed bottom-6 right-6 z-50 px-3 py-1.5 rounded-lg bg-[#1f2937] border border-[#374151] text-xs text-slate-300 font-mono pointer-events-none">
            g…
          </div>
        )}

        <div className="flex flex-col flex-1 overflow-hidden">
          <AnimatedRoutes settings={settings} />
        </div>

        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: { background: '#0d1117', border: '1px solid #1f2937', color: '#f1f5f9' },
          }}
        />
        <ShortcutDialog open={shortcutOpen} onOpenChange={setShortcutOpen} />
      </div>
    </TooltipProvider>
  )
}

export default function App() {
  return <AppInner />
}
