import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUp, Eye, EyeOff, Lightbulb, Plus, ScanLine, TrendingUp, Wallet } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { useUI } from '../components/layout/Shell'
import { EmptyState, Money, Progress, Segmented, cx } from '../components/ui'
import PeriodPicker from '../components/PeriodPicker'
import TxRow from '../components/TxRow'
import WalletArt from '../components/WalletArt'
import { BalanceChart, CategoryPie, CompareChart, IncomeExpenseChart } from '../components/charts'
import { budgetStatuses, expenseByCategory, flowOf, inRange, netWorthAt, totalsByKind } from '../lib/calc'
import { periodSeries } from '../lib/series'
import { formatDate, shiftPeriodKey } from '../lib/dates'
import { buildInsights } from '../lib/insights'
import { formatMoney } from '../lib/money'
import { iconFor } from '../lib/categoryIcon'

const greet = () => { const h = new Date().getHours(); return h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam' }
const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)

export default function Dashboard() {
  const { accounts, transactions, categories, budgets, goals, settings, period, periodOf, updateSettings } = useApp()
  const { openTx } = useUI()
  const nav = useNavigate()
  const [key, setKey] = useState(period.key)
  const [range, setRange] = useState<'3' | '6' | '12'>('6')
  const rates = settings.rates

  const d = useMemo(() => {
    const p = periodOf(key), prev = periodOf(shiftPeriodKey(key, -1))
    const cur = inRange(transactions, p), prv = inRange(transactions, prev)
    const f = flowOf(cur, accounts, rates), pf = flowOf(prv, accounts, rates)
    const catCur = expenseByCategory(cur, accounts, rates), catPrev = expenseByCategory(prv, accounts, rates)
    const cat = (id: string) => categories.find((c) => c.id === id)
    const pie = [...catCur.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ name: cat(id)?.name ?? 'Tanpa kategori', value: v, color: cat(id)?.color ?? '#8a8f98' }))
    const top = [...new Set([...catCur.keys(), ...catPrev.keys()])].sort((a, b) => (catCur.get(b) ?? 0) + (catPrev.get(b) ?? 0) - (catCur.get(a) ?? 0) - (catPrev.get(a) ?? 0)).slice(0, 6)
    const upTo = Math.min(p.end.getTime() - 1, Date.now())
    const nowWorth = netWorthAt(accounts, transactions, rates, upTo), prevWorth = netWorthAt(accounts, transactions, rates, prev.end.getTime() - 1)
    const budgetSt = budgetStatuses(budgets, categories, catCur)
    const bTotal = budgetSt.reduce((s, x) => s + x.budget.amount, 0), bSpent = budgetSt.reduce((s, x) => s + x.spent, 0)
    const ins = buildInsights({ periodKey: key, accounts, transactions, categories, budgets, settings })
    return {
      p, totals: totalsByKind(accounts, transactions, rates), f, incDelta: delta(f.income, pf.income), expDelta: delta(f.expense, pf.expense),
      worthDelta: prevWorth > 0 ? Math.round(((nowWorth - prevWorth) / prevWorth) * 100) : null,
      series: periodSeries(Number(range), key, accounts, transactions, settings), trend: periodSeries(6, key, accounts, transactions, settings),
      pie, compare: top.map((id) => ({ name: cat(id)?.name ?? 'Tanpa kategori', sekarang: catCur.get(id) ?? 0, sebelumnya: catPrev.get(id) ?? 0 })),
      bTotal, bSpent, insight: ins.find((i) => i.tone === 'warn') ?? ins[0],
    }
  }, [accounts, transactions, categories, budgets, settings, key, range, periodOf, rates])

  const recent = useMemo(() => [...transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6), [transactions])
  const activeGoals = useMemo(() => goals.map((g) => ({ g, got: g.entries.reduce((s, e) => s + e.amount, 0) })).sort((a, b) => b.got / b.g.target - a.got / a.g.target).slice(0, 3), [goals])
  const name = settings.userName?.trim()

  if (accounts.length === 0) {
    return (
      <>
        <Greeting name={name} sub="Mulai dengan menambahkan tempat Anda menyimpan uang." />
        <div className="card"><EmptyState icon={<Wallet size={22} />} title="Belum ada akun" text="Tambahkan dompet tunai, rekening bank, atau e-wallet. Saldo awal akan menjadi titik mulai perhitungan." action={<button className="btn-primary" onClick={() => nav('/akun')}><Plus size={16} />Tambah akun pertama</button>} /></div>
      </>
    )
  }

  const pctText = (v: number | null, suffix = '') => (v === null ? null : `${v >= 0 ? '↑ +' : '↓ '}${Math.abs(v)}%${suffix}`)
  const kinds = [{ label: 'Cash', v: d.totals.cash }, { label: 'Bank', v: d.totals.bank }, { label: 'E-wallet', v: d.totals.ewallet }]
  const bPct = d.bTotal ? Math.min(100, (d.bSpent / d.bTotal) * 100) : 0

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <Greeting name={name} sub="Berikut ringkasan keuanganmu periode ini." inline />
        <div className="flex items-center gap-2"><PeriodPicker value={key} onChange={setKey} /><button className="btn-secondary sm:hidden" onClick={() => nav('/scan')} aria-label="Scan struk"><ScanLine size={16} /></button></div>
      </div>

      {/* Balance + income + expense */}
      <div className="grid grid-cols-2 xl:grid-cols-[1.45fr_1fr_1fr] gap-4 mb-4">
        <section className="hero col-span-2 xl:col-span-1 p-5 sm:p-6 min-h-[200px]" aria-label="Total saldo">
          <WalletArt className="absolute right-2 sm:right-5 top-3 w-[120px] sm:w-[160px] opacity-95 drop-shadow-[0_18px_22px_rgba(30,10,100,.55)]" />
          <svg className="absolute inset-x-0 bottom-0 w-full h-16 opacity-40" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden><path d="M0 50 C60 20 110 55 170 32 S280 10 400 30 V60 H0Z" fill="rgb(255 255 255 / .22)" /></svg>
          <div className="relative">
            <div className="flex items-center gap-2 text-white/80">Total Saldo
              <button onClick={() => updateSettings({ hideBalance: !settings.hideBalance })} aria-label={settings.hideBalance ? 'Tampilkan nominal' : 'Sembunyikan nominal'} className="hover:text-white">{settings.hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
            <p className="text-[32px] sm:text-[40px] font-semibold mt-1 leading-tight" style={{ letterSpacing: '-1.2px' }}><Money minor={d.totals.total} /></p>
            {d.worthDelta !== null && <p className="text-[13px] text-emerald-300 mt-1 font-medium">{pctText(d.worthDelta, ' dari periode lalu')}</p>}
            <div className="grid grid-cols-3 gap-2 mt-5 max-w-md">
              {kinds.map((k) => (
                <div key={k.label} className="rounded-lg px-2.5 py-2 min-w-0" style={{ background: 'rgb(255 255 255 / .14)', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / .3)' }}>
                  <p className="text-[11px] text-white/75">{k.label}</p><p className="text-[13px] font-medium truncate"><Money minor={k.v} compact /></p>
                </div>))}
            </div>
          </div>
        </section>
        <Flow kind="income" value={d.f.income} change={d.incDelta} />
        <Flow kind="expense" value={d.f.expense} change={d.expDelta} />
      </div>

      {/* Mobile budget ring */}
      <section className="card p-5 mb-4 lg:hidden">
        <h2 className="h2 mb-3">Ringkasan Periode Ini</h2>
        <div className="flex items-center gap-5">
          <Ring percent={bPct} />
          <div className="min-w-0">
            {d.bTotal ? (<><p className="text-ink-subtle text-[13px]">Budget Bulanan</p><p className="text-[22px] font-semibold" style={{ letterSpacing: '-0.5px' }}><Money minor={Math.max(0, d.bTotal - d.bSpent)} /></p><p className="text-ink-subtle text-[13px]">tersisa dari <Money minor={d.bTotal} /></p></>)
              : (<><p className="text-ink-subtle text-[13px]">Selisih pemasukan dan pengeluaran</p><p className={cx('text-[22px] font-semibold', d.f.net >= 0 ? 'text-income' : 'text-expense')}><Money minor={d.f.net} sign /></p><Link to="/anggaran" className="text-primary-hover text-[13px]">Atur anggaran →</Link></>)}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4 mb-4">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="h2">Arus Keuangan</h2>
            <Segmented className="!w-auto" value={range} onChange={setRange} options={[{ value: '3', label: '3B' }, { value: '6', label: '6B' }, { value: '12', label: '12B' }]} />
          </div>
          <div className="flex gap-4 mb-2 text-caption text-ink-subtle"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-emerald-400" />Pemasukan</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-violet-400" />Pengeluaran</span></div>
          <IncomeExpenseChart data={d.series} />
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="h2">Pengeluaran per Kategori</h2><Link to="/analisis" className="text-ink-subtle hover:text-ink" aria-label="Buka analisis"><ArrowRight size={16} /></Link></div>
          {d.pie.length ? <CategoryPie data={d.pie} /> : <Empty text="Belum ada pengeluaran pada periode ini." />}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 mb-4">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 h-14"><h2 className="h2">Transaksi Terbaru</h2>{transactions.length > 0 && <Link to="/transaksi" className="text-primary-hover font-medium text-[13px] flex items-center gap-1">Lihat Semua <ArrowRight size={13} /></Link>}</div>
          {recent.length ? recent.map((t) => <TxRow key={t.id} t={t} showDate />) : (
            <EmptyState icon={<Plus size={22} />} title="Belum ada transaksi" text="Catat pemasukan atau pengeluaran pertama Anda, atau pindai struk belanja." action={<button className="btn-primary" onClick={() => openTx()}><Plus size={16} />Tambah transaksi</button>} />
          )}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="h2">Target Tabungan</h2><Link to="/target" className="text-primary-hover font-medium text-[13px] flex items-center gap-1">Lihat Semua <ArrowRight size={13} /></Link></div>
          {activeGoals.length === 0 ? <div className="py-8 text-center text-ink-subtle">Belum ada target. <Link to="/target" className="text-primary-hover">Buat target →</Link></div> : (
            <ul className="space-y-5">
              {activeGoals.map(({ g, got }) => { const I = iconFor(g.name), p = (got / g.target) * 100; return (
                <li key={g.id}>
                  <div className="flex items-center gap-3 mb-2"><span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundImage: 'linear-gradient(145deg,#a78bfa,#6d4aff)', boxShadow: 'inset 0 1.5px 0 rgb(255 255 255 / .45)' }}><I size={17} /></span>
                    <div className="min-w-0 flex-1"><p className="font-medium truncate">{g.name}</p><p className="text-caption text-ink-subtle num"><Money minor={got} /> / <Money minor={g.target} /></p></div>
                    <span className="num text-[13px] text-ink-muted">{Math.min(100, Math.round(p))}%</span></div>
                  <Progress percent={p} level={p >= 100 ? 0 : undefined} />
                  {g.deadline && <p className="text-caption text-ink-subtle mt-1.5">Deadline: {formatDate(g.deadline + 'T12:00:00')}</p>}
                </li>) })}
            </ul>
          )}
        </section>
      </div>

      {d.insight && (
        <Link to="/analisis" className="card relative overflow-hidden flex items-center gap-4 p-5 mb-4 group">
          <svg className="absolute right-0 bottom-0 h-full w-1/2 opacity-60" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden><path d="M0 100 C80 90 120 30 200 45 S280 20 300 0 V100Z" fill="rgb(124 92 255 / .28)" /></svg>
          <span className="relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-amber-200" style={{ background: 'radial-gradient(circle at 35% 30%, rgb(251 191 36 / .4), rgb(251 191 36 / .08))', boxShadow: 'inset 0 1.5px 0 rgb(255 255 255 / .35)' }}><Lightbulb size={22} /></span>
          <div className="relative flex-1 min-w-0"><p className="font-semibold">Insight Periode Ini</p><p className="text-ink-muted mt-0.5">{d.insight.text}</p></div>
          <span className="relative btn-secondary !w-10 !h-10 !p-0 !rounded-full group-hover:brightness-125"><ArrowRight size={16} /></span>
        </Link>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="card p-5"><h2 className="h2 mb-4">Perkembangan Total Saldo</h2><BalanceChart data={d.trend} /></section>
        <section className="card p-5"><h2 className="h2 mb-4">Dibanding Periode Sebelumnya</h2>{d.compare.length ? <CompareChart data={d.compare} /> : <Empty text="Belum ada data pengeluaran untuk dibandingkan." />}</section>
      </div>
    </>
  )
}

function Greeting({ name, sub, inline }: { name?: string; sub: string; inline?: boolean }) {
  const el = (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-12 h-12 rounded-xl card flex items-center justify-center text-primary-hover shrink-0"><TrendingUp size={24} /></span>
      <div className="min-w-0"><h1 className="h1 truncate">Selamat {greet()}{name ? `, ${name}` : ''}!</h1><p className="text-ink-subtle mt-0.5">{sub}</p></div>
    </div>
  )
  return inline ? el : <div className="mb-6">{el}</div>
}

function Flow({ kind, value, change }: { kind: 'income' | 'expense'; value: number; change: number | null }) {
  const inc = kind === 'income'
  const tint = inc ? '34 197 94' : '255 100 112'
  return (
    <section className="card p-4 sm:p-5 min-w-0" style={{ backgroundImage: `var(--card-sheen), linear-gradient(145deg, rgb(${tint} / .22), rgb(${tint} / 0) 65%)` }}>
      <div className="flex items-start justify-between gap-2">
        <p className={cx('font-medium text-[13px] sm:text-[14px]', inc ? 'text-income' : 'text-expense')}>{inc ? 'Pemasukan' : 'Pengeluaran'}</p>
        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `rgb(${tint} / .2)`, boxShadow: 'inset 0 1px 0 rgb(255 255 255 / .35)', color: `rgb(${tint})` }}>{inc ? <ArrowDown size={15} /> : <ArrowUp size={15} />}</span>
      </div>
      <p className="text-[18px] sm:text-[24px] font-semibold mt-2 truncate" style={{ letterSpacing: '-0.6px' }}><Money minor={value} compact /></p>
      <p className={cx('text-[12px] sm:text-[13px] font-medium mt-1', inc ? 'text-income' : 'text-expense')}>{change === null ? <span className="text-ink-faint font-normal">Belum ada pembanding</span> : `${change >= 0 ? '↑ +' : '↓ '}${Math.abs(change)}%`}</p>
    </section>
  )
}

function Ring({ percent }: { percent: number }) {
  const r = 36, c = 2 * Math.PI * r
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" className="shrink-0" role="img" aria-label={`${Math.round(percent)}% anggaran terpakai`}>
      <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4ade80" /><stop offset="1" stopColor="#14b8a6" /></linearGradient></defs>
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--track)" strokeWidth="9" />
      <circle cx="46" cy="46" r={r} fill="none" stroke="url(#ring)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform="rotate(-90 46 46)" style={{ transition: 'stroke-dashoffset .7s' }} />
      <text x="46" y="52" textAnchor="middle" className="num" fontSize="18" fontWeight="600" fill="rgb(var(--ink))">{Math.round(percent)}%</text>
    </svg>
  )
}
const Empty = ({ text }: { text: string }) => <div className="h-[190px] flex items-center justify-center text-ink-faint text-center px-4">{text}</div>
