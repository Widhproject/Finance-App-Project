import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, ArrowLeftRight, X } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useUI } from '../components/layout/Shell'
import { EmptyState, Money, PageHeader, Segmented, cx } from '../components/ui'
import TxRow from '../components/TxRow'
import PeriodPicker from '../components/PeriodPicker'
import { dayKey, formatDayHeading, inPeriod } from '../lib/dates'
import { toBase } from '../lib/calc'

type TypeFilter = 'all' | 'income' | 'expense' | 'transfer'

export default function Transactions() {
  const { transactions, accounts, categories, period, periodOf, settings } = useApp()
  const { openTx } = useUI()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  useEffect(() => { const v = params.get('q'); if (v !== null) { setQ(v); setScope('all') } }, [params])
  const [type, setType] = useState<TypeFilter>('all')
  const [catId, setCatId] = useState('')
  const [accId, setAccId] = useState('')
  const [scope, setScope] = useState<'month' | 'range' | 'all'>('month')
  const [monthKey, setMonthKey] = useState(period.key)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<'new' | 'old'>('new')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    const p = periodOf(monthKey), needle = q.trim().toLowerCase()
    const list = transactions.filter((t) => {
      if (scope === 'month' && !inPeriod(t.date, p)) return false
      const k = dayKey(t.date)
      if (scope === 'range' && ((from && k < from) || (to && k > to))) return false
      if (type !== 'all' && t.type !== type) return false
      if (catId && t.categoryId !== catId) return false
      if (accId && t.accountId !== accId && t.toAccountId !== accId) return false
      if (needle && !(t.name.toLowerCase().includes(needle) || (t.merchant ?? '').toLowerCase().includes(needle) || t.note.toLowerCase().includes(needle))) return false
      return true
    })
    return list.sort((a, b) => (sort === 'new' ? +new Date(b.date) - +new Date(a.date) : +new Date(a.date) - +new Date(b.date)))
  }, [transactions, q, type, catId, accId, scope, monthKey, from, to, sort, periodOf])

  const groups = useMemo(() => {
    const m = new Map<string, typeof filtered>()
    for (const t of filtered) { const k = dayKey(t.date); (m.get(k) ?? m.set(k, []).get(k)!).push(t) }
    return [...m.entries()]
  }, [filtered])

  const cur = new Map(accounts.map((a) => [a.id, a.currency]))
  const dayNet = (ts: typeof filtered) => ts.reduce((s, t) => (t.type === 'transfer' ? s : s + (t.type === 'income' ? 1 : -1) * toBase(t.amount, cur.get(t.accountId) ?? 'IDR', settings.rates)), 0)
  const activeFilters = [type !== 'all', !!catId, !!accId, scope === 'range' && !!(from || to)].filter(Boolean).length
  const reset = () => { setQ(''); setType('all'); setCatId(''); setAccId(''); setFrom(''); setTo(''); setScope('month'); setMonthKey(period.key) }

  return (
    <>
      <PageHeader title="Transaksi" subtitle={`${filtered.length} transaksi ditampilkan`} actions={<button className="btn-primary lg:hidden" onClick={() => openTx()}><Plus size={16} />Tambah</button>} />

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input className="input pl-9" placeholder="Cari nama transaksi" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari transaksi" />
          </div>
          {scope === 'month' && <PeriodPicker value={monthKey} onChange={setMonthKey} />}
          <button className={cx('btn-secondary', showFilters && 'bg-s2')} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><SlidersHorizontal size={16} />Filter{activeFilters > 0 && <span className="badge bg-primary text-white">{activeFilters}</span>}</button>
        </div>
        {showFilters && (
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade">
            <div className="sm:col-span-2 lg:col-span-4"><Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'Semua' }, { value: 'income', label: 'Pemasukan' }, { value: 'expense', label: 'Pengeluaran' }, { value: 'transfer', label: 'Transfer' }]} /></div>
            <div><label className="label">Rentang waktu</label>
              <select className="input" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}><option value="month">Per bulan</option><option value="range">Pilih tanggal</option><option value="all">Semua waktu</option></select></div>
            <div><label className="label">Kategori</label>
              <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}><option value="">Semua kategori</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === 'income' ? 'masuk' : 'keluar'})</option>)}</select></div>
            <div><label className="label">Akun</label>
              <select className="input" value={accId} onChange={(e) => setAccId(e.target.value)}><option value="">Semua akun</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className="label">Urutkan</label>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="new">Terbaru dulu</option><option value="old">Terlama dulu</option></select></div>
            {scope === 'range' && (<>
              <div><label className="label">Dari tanggal</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label className="label">Sampai tanggal</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>)}
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button className="btn-ghost" onClick={reset}><X size={14} />Atur ulang filter</button></div>
          </div>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="panel"><EmptyState icon={<ArrowLeftRight size={20} />} title="Belum ada transaksi" text="Semua pemasukan, pengeluaran, dan transfer akan muncul di sini, dikelompokkan per hari." action={<button className="btn-primary" onClick={() => openTx()}><Plus size={16} />Tambah transaksi</button>} /></div>
      ) : groups.length === 0 ? (
        <div className="panel"><EmptyState icon={<Search size={20} />} title="Tidak ada hasil" text="Tidak ada transaksi yang cocok dengan pencarian atau filter ini." action={<button className="btn-secondary" onClick={reset}>Atur ulang filter</button>} /></div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, ts]) => (
            <section key={day} className="card overflow-hidden">
              <header className="flex items-center justify-between px-4 sm:px-5 h-11 bg-s2/60 border-b border-hair">
                <h2 className="text-[13px] font-medium text-ink-muted">{formatDayHeading(day)}</h2>
                <span className="text-[13px] text-ink-subtle"><Money minor={dayNet(ts)} sign /></span>
              </header>
              {ts.map((t) => <TxRow key={t.id} t={t} />)}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
