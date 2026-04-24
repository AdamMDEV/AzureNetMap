import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from './components/ui/tooltip'
import { TopBar } from './components/TopBar'
import { Toaster } from 'sonner'

const MapPage = lazy(() => import('./pages/MapPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const VMPage = lazy(() => import('./pages/VMPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ThreatsPage = lazy(() => import('./pages/ThreatsPage'))

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center text-slate-500 text-sm">
      Loading...
    </div>
  )
}

export default function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-screen" style={{ background: '#0a0e1a', color: '#f1f5f9' }}>
        <TopBar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/vm/:name" element={<VMPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/threats" element={<ThreatsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: { background: '#0d1117', border: '1px solid #1f2937', color: '#f1f5f9' },
          }}
        />
      </div>
    </TooltipProvider>
  )
}
