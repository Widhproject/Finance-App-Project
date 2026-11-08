import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, CalendarDays, Eye, EyeOff, LayoutDashboard, Lock, MoreHorizontal, Moon, NotebookPen, Plus, Repeat, ScanLine, Settings as Cog, Sun, Target, Wallet, ArrowLeftRight, PiggyBank } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import TransactionForm, { type TxPreset } from '../TransactionForm'
import { Modal, ToastHost, cx } from '../ui'
import { todayKey, dayKey } from '../../lib/dates'

interface UI { openTx: (preset?: TxPreset) => void }
const UIC = createContext<UI>({ openTx: () => {} })
export const useUI = () => useContext(UIC)

const MAIN = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transaksi', label: 'Transaksi', icon: ArrowLeftRight },
  { to: '/akun', label: 'Akun Saya', icon: Wallet },
  { to: '/anggaran', label: 'Anggaran', icon: PiggyBank },
  { to: '/target', label: 'Target Tabungan', icon: Target },
  { to: '/analisis', label: 'Analisis', icon: BarChart3 },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
  { to: '/pengaturan', label: 'Pengaturan', icon: Cog },
]
const EXTRA = [
  { to: '/scan', label: 'Scan Struk', icon: ScanLine },
  { to: '/berulang', label: 'Transaksi Berulang', icon: Repeat },
  { to: '/catatan', label: 'Catatan', icon: NotebookPen },
]

function useAutoLock() {
  const { settings, lock, locked } = useApp()
  const last = useRef(Date.now())
  useEffect(() => {
    if (locked || !settings.pinHash || settings.autoLockMinutes <= 0) return
    const limit = settings.autoLockMinutes * 60_000
    const touch = () => { last.current = Date.now() }
    const check = () => { if (Date.now() - last.current > limit) lock() }
    const vis = () => { if (document.visibilityState === 'visible') check() }
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    document.addEventListener('visibilitychange', vis)
    const id = setInterval(check, 5000)
    touch()
    return () => { evs.forEach((e) => window.removeEventListener(e, touch)); document.removeEventListener('visibilitychange', vis); clearInterval(id) }
  }, [locked, settings.pinHash, settings.autoLockMinutes, lock])
}

/** In-app reminder to log transactions. Works while the app is open (no background push without a server). */
function useReminder() {
  const { settings, transactions, updateSettings, toast, locked } = useApp()
  useEffect(() => {
    if (locked || !settings.reminder.enabled) return
    const tick = () => {
      const now = new Date(), [h, m] = settings.reminder.time.split(':').map(Number)
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m || settings.lastReminderDate === todayKey()) return
      updateSettings({ lastReminderDate: todayKey() })
      if (transactions.some((t) => dayKey(t.date) === todayKey())) return
      const msg = 'Belum ada transaksi tercatat hari ini. Sempatkan mencatat pengeluaran Anda.'
      toast(msg, 'info')
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Pengingat catat transaksi', { body: msg })
    }
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id)
  }, [locked, settings.reminder.enabled, settings.reminder.time, settings.lastReminderDate, transactions, toast, updateSettings])
}

const linkCls = ({ isActive }: { isActive: boolean }) =>
  cx('flex items-center gap-3 h-9 px-3 rounded-md text-[14px] font-medium transition-colors', isActive ? 'bg-s2 text-ink' : 'text-ink-subtle hover:text-ink hover:bg-s1')

export default function Shell({ children }: { children: ReactNode }) {
  const { settings, updateSettings, lock } = useApp()
  const nav = useNavigate(), loc = useLocation()
  const [tx, setTx] = useState<{ open: boolean; preset?: TxPreset }>({ open: false })
  const [more, setMore] = useState(false)
  const openTx = useCallback((preset?: TxPreset) => setTx({ open: true, preset }), [])
  useAutoLock(); useReminder()
  useEffect(() => { setMore(false); window.scrollTo(0, 0) }, [loc.pathname])

  const eye = (
    <button className="btn-icon" onClick={() => updateSettings({ hideBalance: !settings.hideBalance })} aria-label={settings.hideBalance ? 'Tampilkan nominal' : 'Sembunyikan nominal'} aria-pressed={settings.hideBalance}>
      {settings.hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )

  return (
    <UIC.Provider value={{ openTx }}>
      <div className="min-h-dvh lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 h-dvh sticky top-0 border-r border-hair px-3 py-4">
          <div className="flex items-center gap-2.5 px-3 h-10 mb-4">
            <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center" aria-hidden><svg viewBox="0 0 64 64" width="16" height="16"><path d="M20 44V20h20a7 7 0 0 1 0 14H28" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <span className="font-semibold" style={{ letterSpacing: '-0.2px' }}>Keuangan</span>
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="Menu utama">
            {MAIN.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}><n.icon size={17} />{n.label}</NavLink>)}
          </nav>
          <div className="h-px bg-hair my-3 mx-3" />
          <nav className="flex flex-col gap-0.5" aria-label="Menu tambahan">
            {EXTRA.map((n) => <NavLink key={n.to} to={n.to} className={linkCls}><n.icon size={17} />{n.label}</NavLink>)}
          </nav>
          <div className="mt-auto flex items-center justify-between px-1">
            <button className="btn-ghost h-9 px-3" onClick={lock}><Lock size={15} />Kunci</button>
            <button className="btn-icon" aria-label="Ganti tema" onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>{settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-hair pt-safe">
            <div className="h-14 px-4 lg:px-8 max-w-[1280px] mx-auto flex items-center justify-between gap-2">
              <div className="lg:hidden flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center" aria-hidden><svg viewBox="0 0 64 64" width="16" height="16"><path d="M20 44V20h20a7 7 0 0 1 0 14H28" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <span className="font-semibold">Keuangan</span>
              </div>
              <div className="hidden lg:block" />
              <div className="flex items-center gap-1.5">
                {eye}
                <button className="btn-icon lg:hidden" onClick={lock} aria-label="Kunci aplikasi"><Lock size={18} /></button>
                <button className="btn-secondary hidden sm:inline-flex" onClick={() => nav('/scan')}><ScanLine size={16} />Scan Struk</button>
                <button className="btn-primary hidden lg:inline-flex" onClick={() => openTx()}><Plus size={16} />Tambah Transaksi</button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 pb-28 lg:pb-12 w-full max-w-[1280px] mx-auto">{children}</main>
        </div>

        {/* Mobile bottom navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas/95 backdrop-blur border-t border-hair pb-safe" aria-label="Menu utama">
          <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-2">
            <BottomLink to="/" icon={LayoutDashboard} label="Beranda" end />
            <BottomLink to="/transaksi" icon={ArrowLeftRight} label="Transaksi" />
            <button onClick={() => openTx()} aria-label="Tambah transaksi" className="mx-auto -mt-5 w-12 h-12 rounded-lg bg-primary text-white flex items-center justify-center active:brightness-90 border border-canvas" style={{ boxShadow: '0 0 0 4px rgb(var(--canvas))' }}><Plus size={22} /></button>
            <BottomLink to="/anggaran" icon={PiggyBank} label="Anggaran" />
            <button onClick={() => setMore(true)} className={cx('flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium', ['/akun', '/target', '/analisis', '/kalender', '/pengaturan', '/scan', '/berulang', '/catatan'].includes(loc.pathname) ? 'text-ink' : 'text-ink-subtle')}><MoreHorizontal size={20} />Lainnya</button>
          </div>
        </nav>

        <Modal open={more} onClose={() => setMore(false)} title="Menu">
          <div className="grid grid-cols-2 gap-2">
            {[...MAIN.slice(2), ...EXTRA].map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('card flex items-center gap-3 px-3 h-12 text-[14px] font-medium', isActive && 'bg-s2 border-hair-strong')}><n.icon size={17} className="text-ink-subtle" />{n.label}</NavLink>
            ))}
          </div>
        </Modal>

        <TransactionForm open={tx.open} initial={tx.preset} onClose={() => setTx({ open: false })} />
        <ToastHost />
      </div>
    </UIC.Provider>
  )
}

function BottomLink({ to, icon: Icon, label, end }: { to: string; icon: typeof Plus; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium', isActive ? 'text-ink' : 'text-ink-subtle')}>
      <Icon size={20} />{label}
    </NavLink>
  )
}
