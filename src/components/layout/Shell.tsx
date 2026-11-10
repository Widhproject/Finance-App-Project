import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, CalendarDays, Eye, EyeOff, LayoutDashboard, Lock, MoreHorizontal, Moon, NotebookPen, Plus, Repeat, ScanLine, Search, Settings as Cog, Sun, Target, Wallet, ArrowLeftRight, PiggyBank } from 'lucide-react'
import Logo from '../Logo'
import { useAlerts } from '../useAlerts'
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
  cx('flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] font-medium transition-all', isActive ? 'nav-active' : 'text-ink-subtle hover:text-ink hover:bg-white/[0.06]')

function initials(name?: string) { return (name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'U' }

function Bell_() {
  const alerts = useAlerts(), nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button className="btn-icon relative" onClick={() => setOpen(!open)} aria-label={`Notifikasi${alerts.length ? `, ${alerts.length} baru` : ''}`} aria-expanded={open}>
        <Bell size={18} />{alerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-expense ring-2 ring-canvas" />}
      </button>
      {open && (
        <div className="card !bg-s2 !backdrop-blur-none absolute right-0 mt-2 w-[min(340px,86vw)] z-50 animate-fade overflow-hidden">
          <p className="px-4 py-3 h2 border-b border-hair">Notifikasi</p>
          {alerts.length === 0 ? <p className="px-4 py-8 text-center text-ink-subtle">Tidak ada notifikasi. Semua aman.</p> : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-hair">
              {alerts.map((a) => <li key={a.id}><button className="w-full text-left px-4 py-3 flex gap-3 hover:bg-white/[0.05]" onClick={() => { setOpen(false); nav(a.to) }}>
                <span className={cx('w-2 h-2 rounded-full mt-2 shrink-0', a.tone === 'bad' ? 'bg-expense' : a.tone === 'warn' ? 'bg-warn' : 'bg-primary')} /><span className="text-ink-muted">{a.text}</span></button></li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { settings, updateSettings, lock } = useApp()
  const nav = useNavigate(), loc = useLocation()
  const [tx, setTx] = useState<{ open: boolean; preset?: TxPreset }>({ open: false })
  const [more, setMore] = useState(false)
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const openTx = useCallback((preset?: TxPreset) => setTx({ open: true, preset }), [])
  useAutoLock(); useReminder()
  useEffect(() => { setMore(false); window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  const dark = settings.theme === 'dark'
  const toggleTheme = () => updateSettings({ theme: dark ? 'light' : 'dark' })

  const eye = (
    <button className="btn-icon" onClick={() => updateSettings({ hideBalance: !settings.hideBalance })} aria-label={settings.hideBalance ? 'Tampilkan nominal' : 'Sembunyikan nominal'} aria-pressed={settings.hideBalance}>
      {settings.hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )

  return (
    <UIC.Provider value={{ openTx }}>
      <div className="min-h-dvh lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-[248px] shrink-0 h-dvh sticky top-0 border-r border-hair/70 px-4 py-5" style={{ background: 'rgb(var(--canvas) / 0.55)', backdropFilter: 'blur(18px)' }}>
          <div className="flex flex-col items-start gap-2 px-2 mb-7"><Logo size={44} /><span className="text-[22px] font-semibold" style={{ letterSpacing: '-0.5px' }}>duitku</span></div>
          <nav className="flex flex-col gap-1" aria-label="Menu utama">
            {MAIN.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}><n.icon size={17} />{n.label}</NavLink>)}
          </nav>
          <div className="h-px bg-hair my-4 mx-3" />
          <nav className="flex flex-col gap-1" aria-label="Menu tambahan">
            {EXTRA.map((n) => <NavLink key={n.to} to={n.to} className={linkCls}><n.icon size={17} />{n.label}</NavLink>)}
          </nav>
          <div className="mt-auto space-y-3">
            <div className="flex items-center justify-center gap-3" role="group" aria-label="Tema">
              <Sun size={16} className={dark ? 'text-ink-faint' : 'text-warn'} />
              <button role="switch" aria-checked={dark} aria-label="Mode gelap" onClick={toggleTheme} className="relative w-[52px] h-7 rounded-full border border-hair-strong transition-colors" style={{ background: dark ? 'linear-gradient(180deg,#8a6bff,#5f3ff0)' : 'rgb(var(--surface-3))', boxShadow: 'var(--input-shadow)' }}>
                <span className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-all" style={{ left: dark ? 27 : 3, boxShadow: '0 2px 5px rgb(0 0 0 / .35), inset 0 -1px 0 rgb(0 0 0 / .1)' }} />
              </button>
              <Moon size={16} className={dark ? 'text-primary-hover' : 'text-ink-faint'} />
            </div>
            <button className="btn-ghost w-full" onClick={lock}><Lock size={15} />Kunci aplikasi</button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 border-b border-hair/60 pt-safe" style={{ background: 'rgb(var(--canvas) / 0.65)', backdropFilter: 'blur(18px)' }}>
            <div className="h-16 px-4 lg:px-8 max-w-[1320px] mx-auto flex items-center justify-between gap-3">
              <div className="lg:hidden flex items-center gap-2"><Logo size={30} /><span className="font-semibold text-[16px]">duitku</span></div>
              <form className="hidden lg:flex flex-1 max-w-xl relative" role="search" onSubmit={(e) => { e.preventDefault(); nav(`/transaksi${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); searchRef.current?.blur() }}>
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input ref={searchRef} className="input !h-11 !rounded-full pl-10 pr-14" placeholder="Cari transaksi, kategori…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari transaksi" />
                <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-faint border border-hair rounded px-1.5 py-0.5">⌘ K</kbd>
              </form>
              <div className="flex items-center gap-1.5">
                {eye}
                <Bell_ />
                <button className="btn-icon lg:hidden" onClick={lock} aria-label="Kunci aplikasi"><Lock size={18} /></button>
                <button className="btn-secondary hidden sm:inline-flex" onClick={() => nav('/scan')}><ScanLine size={16} />Scan Struk</button>
                <button className="btn-primary hidden lg:inline-flex" onClick={() => openTx()}><Plus size={16} />Tambah Transaksi</button>
                <NavLink to="/pengaturan" aria-label="Pengaturan profil" className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center text-white font-semibold text-[13px] ml-1" style={{ backgroundImage: 'linear-gradient(135deg,#c4b5fd,#7c5cff 60%,#5b34e6)', boxShadow: 'inset 0 1.5px 0 rgb(255 255 255 / .55), 0 6px 14px -4px rgb(124 92 255 / .8)' }}>{initials(settings.userName)}</NavLink>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 pb-32 lg:pb-12 w-full max-w-[1320px] mx-auto">{children}</main>
        </div>

        {/* Mobile bottom navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-hair/70 pb-safe" style={{ background: 'rgb(var(--canvas) / 0.85)', backdropFilter: 'blur(18px)' }} aria-label="Menu utama">
          <div className="grid grid-cols-5 items-center h-[68px] max-w-md mx-auto px-2">
            <BottomLink to="/" icon={LayoutDashboard} label="Beranda" end />
            <BottomLink to="/analisis" icon={BarChart3} label="Analisis" />
            <button onClick={() => openTx()} aria-label="Tambah transaksi" className="btn-primary mx-auto -mt-7 !w-14 !h-14 !rounded-full !p-0"><Plus size={26} /></button>
            <BottomLink to="/akun" icon={Wallet} label="Akun" />
            <button onClick={() => setMore(true)} className={cx('flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium', MORE_PATHS.includes(loc.pathname) ? 'text-primary-hover' : 'text-ink-subtle')}><MoreHorizontal size={20} />Lainnya</button>
          </div>
        </nav>

        <Modal open={more} onClose={() => setMore(false)} title="Menu">
          <div className="grid grid-cols-2 gap-2.5">
            {[MAIN[1], MAIN[3], MAIN[4], MAIN[6], MAIN[7], ...EXTRA].map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('card flex items-center gap-3 px-3 h-12 text-[14px] font-medium', isActive && '!border-primary')}><n.icon size={17} className="text-primary-hover" />{n.label}</NavLink>
            ))}
            <button className="card flex items-center gap-3 px-3 h-12 text-[14px] font-medium text-left" onClick={toggleTheme}>{dark ? <Sun size={17} className="text-primary-hover" /> : <Moon size={17} className="text-primary-hover" />}{dark ? 'Mode terang' : 'Mode gelap'}</button>
          </div>
        </Modal>

        <TransactionForm open={tx.open} initial={tx.preset} onClose={() => setTx({ open: false })} />
        <ToastHost />
      </div>
    </UIC.Provider>
  )
}

const MORE_PATHS = ['/transaksi', '/anggaran', '/target', '/kalender', '/pengaturan', '/scan', '/berulang', '/catatan']

function BottomLink({ to, icon: Icon, label, end }: { to: string; icon: typeof Plus; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium', isActive ? 'text-primary-hover' : 'text-ink-subtle')}>
      <Icon size={20} />{label}
    </NavLink>
  )
}
