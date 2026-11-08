import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import PinGate from './components/PinGate'
import Shell from './components/layout/Shell'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Budgets = lazy(() => import('./pages/Budgets'))
const Goals = lazy(() => import('./pages/Goals'))
const Analysis = lazy(() => import('./pages/Analysis'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const RecurringPage = lazy(() => import('./pages/RecurringPage'))
const Notes = lazy(() => import('./pages/Notes'))
const Scan = lazy(() => import('./pages/Scan'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

export default function App() {
  return (
    <PinGate>
      <Shell>
        <Suspense fallback={<div className="h-40" />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transaksi" element={<Transactions />} />
            <Route path="/akun" element={<Accounts />} />
            <Route path="/anggaran" element={<Budgets />} />
            <Route path="/target" element={<Goals />} />
            <Route path="/analisis" element={<Analysis />} />
            <Route path="/kalender" element={<CalendarPage />} />
            <Route path="/berulang" element={<RecurringPage />} />
            <Route path="/catatan" element={<Notes />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/pengaturan" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </Shell>
    </PinGate>
  )
}
