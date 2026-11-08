import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Banknote, Eye, EyeOff, Landmark, Plus, Repeat, ScanLine, Smartphone, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useUI } from '../components/layout/Shell'
import { Dot, EmptyState, Money, PageHeader, cx } from '../components/ui'
import TxRow from '../components/TxRow'
import { BalanceChart, CategoryPie, CompareChart, IncomeExpenseChart } from '../components/charts'
import { budgetStatuses, expenseByCategory, flowOf, inRange, totalsByKind } from '../lib/calc'
import { periodSeries } from '../lib/series'
import { shiftPeriodKey } from '../lib/dates'
import { dueOccurrences } from '../lib/recurring'
import { todayKey } from '../lib/dates'

export default function Dashboard() {
  const { accounts, transactions, categories, budgets, recurring, settings, period, periodOf, updateSettings } = useApp()
  const { openTx } = useUI()
  const nav = useNavigate()
  const rates = settings.rates

  const d = useMemo(() => {
    const prev = periodOf(shiftPeriodKey(period.key, -1))
    const cur = inRange(transactions, period), prv = inRange(transactions, prev)
    const catCur = expenseByCategory(cur, accounts, rates), catPrev = expenseByCategory(prv, accounts, rates)
    const name = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Tanpa kategori'
    const color = (id: string) => categories.find((c) => c.id === id)?.color ?? '#8a8f98'
    const pie = [...catCur.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ name: name(id), value: v, color: color(id) }))
    const top = [...new Set([...catCur.keys(), ...catPrev.keys()])].sort((a, b) => (catCur.get(b) ?? 0) + (catPrev.get(b) ?? 0) - (catCur.get(a) ?? 0) - (catPrev.get(a) ?? 0)).slice(0, 6)
    return {
      totals: totalsByKind(accounts, transactions, rates), flow: flowOf(cur, accounts, rates), series: periodSeries(6, period.key, accounts, transactions, settings),
      pie, compare: top.map((id) => ({ name: name(id), sekarang: catCur.get(id) ?? 0, sebelumnya: catPrev.get(id) ?? 0 })),
      alerts: budgetStatuses(budgets, categories, catCur).filter((s) => s.level >= 1),
    }
  }, [accounts, transactions, categories, budgets, settings, period, periodOf, rates])

  const dueCount = recurring.reduce((n, r) => n + dueOccurrences(r, todayKey()).length, 0)
  const recent = useMemo(() => [...transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 8), [transactions])

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Selamat datang" subtitle="Mulai dengan menambahkan tempat Anda menyimpan uang." />
        <div className="panel"><EmptyState icon={<Wallet size={20} />} title="Belum ada akun" text="Tambahkan dompet tunai, rekening bank, atau e-wallet. Saldo awal akan menjadi titik mulai perhitungan." action={<button className="btn-primary" onClick={() => nav('/akun')}><Plus size={16} />Tambah akun pertama</button>} /></div>
      </>
    )
  }

  const kinds = [
    { label: 'Cash', value: d.totals.cash, icon: Banknote },
    { label: 'Rekening bank', value: d.totals.bank, icon: Landmark },
    { label: 'E-wallet', value: d.totals.ewallet, icon: Smartphone },
  ]
  return (
    <>
      <PageHeader title="Ringkasan" subtitle={period.label}
        actions={<button className="btn-secondary sm:hidden" onClick={() => nav('/scan')}><ScanLine size={16} />Scan Struk</button>} />

      {(dueCount > 0 || d.alerts.length > 0) && (
        <div className="space-y-2 mb-6">
          {dueCount > 0 && (
            <Link to="/berulang" className="card flex items-center gap-3 px-4 py-3 hover:bg-s2 transition-colors"><Repeat size={16} className="text-primary shrink-0" /><span className="flex-1">{dueCount} transaksi berulang jatuh tempo menunggu konfirmasi Anda.</span><span className="text-primary font-medium">Tinjau</span></Link>
          )}
          {d.alerts.map((a) => (
            <Link key={a.budget.id} to="/anggaran" className="card flex items-center gap-3 px-4 py-3 hover:bg-s2 transition-colors">
              <AlertTriangle size={16} className={cx('shrink-0', a.level >= 2 ? 'text-expense' : 'text-warn')} />
              <span className="flex-1">Anggaran {a.category?.name ?? ''} {a.level === 3 ? 'terlampaui' : `terpakai ${Math.round(a.percent)}%`}.</span>
            </Link>
          ))}
        </div>
      )}

      <section className="panel p-6 mb-4" aria-label="Total saldo">
        <div className="flex items-center justify-between">
          <p className="text-ink-subtle">Total seluruh uang</p>
          <button className="btn-icon -mr-2" onClick={() => updateSettings({ hideBalance: !settings.hideBalance })} aria-label={settings.hideBalance ? 'Tampilkan nominal' : 'Sembunyikan nominal'}>{settings.hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <p className="text-[34px] sm:text-[44px] font-semibold mt-1 leading-tight" style={{ letterSpacing: '-1.2px' }}><Money minor={d.totals.total} /></p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6">
          {kinds.map((k) => (
            <div key={k.label} className="rounded-lg bg-canvas border border-hair px-3 sm:px-4 py-3 min-w-0">
              <div className="flex items-center gap-2 text-ink-subtle text-[12px] sm:text-[14px]"><k.icon size={15} className="shrink-0 hidden sm:block" /><span className="truncate">{k.label}</span></div>
              <p className="text-[13px] sm:text-[18px] font-medium mt-1 truncate" style={{ letterSpacing: '-0.3px' }}><Money minor={k.value} compact /></p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat icon={<TrendingUp size={15} className="text-income" />} label="Pemasukan bulan ini" value={d.flow.income} />
        <Stat icon={<TrendingDown size={15} className="text-expense" />} label="Pengeluaran bulan ini" value={d.flow.expense} />
        <Stat label="Selisih" value={d.flow.net} sign tone={d.flow.net >= 0 ? 'text-income' : 'text-expense'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <section className="card p-5"><h2 className="h2 mb-4">Pemasukan dan pengeluaran</h2><IncomeExpenseChart data={d.series} /><Legend /></section>
        <section className="card p-5"><h2 className="h2 mb-4">Perkembangan total saldo</h2><BalanceChart data={d.series} /></section>
        <section className="card p-5"><h2 className="h2 mb-4">Pengeluaran per kategori</h2>{d.pie.length ? <CategoryPie data={d.pie} /> : <Empty text="Belum ada pengeluaran pada periode ini." />}</section>
        <section className="card p-5"><h2 className="h2 mb-4">Dibanding periode sebelumnya</h2>{d.compare.length ? <CompareChart data={d.compare} /> : <Empty text="Belum ada data pengeluaran untuk dibandingkan." />}</section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between px-4 sm:px-5 h-14 border-b border-hair">
          <h2 className="h2">Transaksi terbaru</h2>
          {transactions.length > 0 && <Link to="/transaksi" className="text-primary font-medium hover:text-primary-hover">Lihat Semua</Link>}
        </div>
        {recent.length ? recent.map((t) => <TxRow key={t.id} t={t} showDate />) : (
          <EmptyState icon={<Plus size={20} />} title="Belum ada transaksi" text="Catat pemasukan atau pengeluaran pertama Anda, atau pindai struk belanja." action={<button className="btn-primary" onClick={() => openTx()}><Plus size={16} />Tambah transaksi</button>} />
        )}
      </section>
    </>
  )
}

function Stat({ label, value, icon, sign, tone }: { label: string; value: number; icon?: React.ReactNode; sign?: boolean; tone?: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-2 text-ink-subtle">{icon}{label}</div>
      <p className={cx('text-[22px] font-semibold mt-1', tone)} style={{ letterSpacing: '-0.5px' }}><Money minor={value} sign={sign} /></p>
    </div>
  )
}
const Legend = () => <div className="flex gap-4 mt-2 text-caption text-ink-subtle"><span className="flex items-center gap-1.5"><Dot color="rgb(var(--income))" />Pemasukan</span><span className="flex items-center gap-1.5"><Dot color="rgb(var(--expense))" />Pengeluaran</span></div>
const Empty = ({ text }: { text: string }) => <div className="h-[220px] flex items-center justify-center text-ink-faint text-center px-4">{text}</div>
