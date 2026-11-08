import { useMemo, useState } from 'react'
import { Lightbulb, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { EmptyState, Money, PageHeader, cx } from '../components/ui'
import PeriodPicker from '../components/PeriodPicker'
import { BalanceChart, CategoryPie, IncomeExpenseChart } from '../components/charts'
import { dailyTotals, expenseByCategory, flowOf, inRange } from '../lib/calc'
import { buildInsights } from '../lib/insights'
import { periodSeries } from '../lib/series'
import { daysInPeriod, formatDate, shiftPeriodKey } from '../lib/dates'

const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)

export default function Analysis() {
  const { accounts, transactions, categories, budgets, settings, period, periodOf } = useApp()
  const [key, setKey] = useState(period.key)

  const d = useMemo(() => {
    const p = periodOf(key), prev = periodOf(shiftPeriodKey(key, -1))
    const cur = inRange(transactions, p), prv = inRange(transactions, prev)
    const f = flowOf(cur, accounts, settings.rates), pf = flowOf(prv, accounts, settings.rates)
    const cats = [...expenseByCategory(cur, accounts, settings.rates).entries()].sort((a, b) => b[1] - a[1])
    const days = [...dailyTotals(cur, accounts, settings.rates).entries()].filter(([, v]) => v.expense > 0).sort((a, b) => b[1].expense - a[1].expense)
    const isCurrent = key === period.key
    const elapsed = isCurrent ? Math.max(1, Math.min(daysInPeriod(p), Math.ceil((Date.now() - p.start.getTime()) / 864e5))) : daysInPeriod(p)
    return {
      f, pf, cats, topDay: days[0], avgDaily: Math.round(f.expense / elapsed), count: cur.length,
      series: periodSeries(6, key, accounts, transactions, settings), trend: periodSeries(12, key, accounts, transactions, settings),
      insights: buildInsights({ periodKey: key, accounts, transactions, categories, budgets, settings }),
      pie: cats.map(([id, v]) => ({ name: categories.find((c) => c.id === id)?.name ?? 'Tanpa kategori', value: v, color: categories.find((c) => c.id === id)?.color ?? '#8a8f98' })),
    }
  }, [key, accounts, transactions, categories, budgets, settings, period.key, periodOf])

  if (transactions.length === 0) return (<><PageHeader title="Analisis" /><div className="panel"><EmptyState icon={<BarChart3 size={20} />} title="Belum ada data untuk dianalisis" text="Catat beberapa transaksi dan analisis serta insight otomatis akan muncul di sini." /></div></>)

  const topCat = d.cats[0]
  const rows = [
    { label: 'Pemasukan', cur: d.f.income, prev: d.pf.income, good: 'up' },
    { label: 'Pengeluaran', cur: d.f.expense, prev: d.pf.expense, good: 'down' },
    { label: 'Arus kas bersih', cur: d.f.net, prev: d.pf.net, good: 'up' },
  ] as const
  const tone = { good: 'text-income', warn: 'text-warn', info: 'text-primary' } as const
  const Icon = { good: CheckCircle2, warn: AlertTriangle, info: Lightbulb } as const

  return (
    <>
      <PageHeader title="Analisis" subtitle="Kondisi keuangan berdasarkan transaksi nyata." actions={<PeriodPicker value={key} onChange={setKey} />} />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Metric label="Pemasukan" value={<Money minor={d.f.income} />} />
        <Metric label="Pengeluaran" value={<Money minor={d.f.expense} />} />
        <Metric label="Saving rate" value={d.f.savingRate === null ? '–' : `${Math.round(d.f.savingRate)}%`} tone={d.f.savingRate !== null && d.f.savingRate < 0 ? 'text-expense' : undefined} />
        <Metric label="Rata-rata harian" value={<Money minor={d.avgDaily} />} />
        <Metric label="Kategori terbesar" value={topCat ? (categories.find((c) => c.id === topCat[0])?.name ?? 'Tanpa kategori') : '–'} small />
        <Metric label="Hari termahal" value={d.topDay ? `${formatDate(d.topDay[0] + 'T12:00:00', false)}` : '–'} sub={d.topDay ? <Money minor={d.topDay[1].expense} /> : undefined} />
      </div>

      <section className="card p-5 mb-6">
        <h2 className="h2 mb-3 flex items-center gap-2"><Lightbulb size={16} className="text-primary" />Financial Insights</h2>
        <ul className="space-y-2.5">
          {d.insights.map((i) => { const I = Icon[i.tone]; return <li key={i.id} className="flex gap-3"><I size={16} className={cx('mt-0.5 shrink-0', tone[i.tone])} /><span className="text-ink-muted">{i.text}</span></li> })}
        </ul>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <section className="card p-5"><h2 className="h2 mb-4">Perbandingan antarbulan</h2><IncomeExpenseChart data={d.series} /></section>
        <section className="card p-5"><h2 className="h2 mb-4">Tren total saldo (12 periode)</h2><BalanceChart data={d.trend} /></section>
        <section className="card p-5"><h2 className="h2 mb-4">Komposisi pengeluaran</h2>{d.pie.length ? <CategoryPie data={d.pie} /> : <p className="text-ink-faint py-16 text-center">Belum ada pengeluaran.</p>}</section>
        <section className="card p-5 overflow-x-auto">
          <h2 className="h2 mb-3">Periode ini vs sebelumnya</h2>
          <table className="w-full text-[14px]"><thead><tr className="text-ink-subtle text-left text-caption"><th className="py-2 font-normal">Ringkasan</th><th className="font-normal text-right">Sebelumnya</th><th className="font-normal text-right">Ini</th><th className="font-normal text-right">Perubahan</th></tr></thead>
            <tbody>{rows.map((r) => { const ch = delta(r.cur, r.prev); const good = ch === null ? null : (r.good === 'up' ? ch >= 0 : ch <= 0)
              return <tr key={r.label} className="border-t border-hair"><td className="py-2.5">{r.label}</td><td className="text-right text-ink-subtle"><Money minor={r.prev} /></td><td className="text-right"><Money minor={r.cur} /></td><td className={cx('text-right num', good === null ? 'text-ink-faint' : good ? 'text-income' : 'text-expense')}>{ch === null ? '–' : `${ch > 0 ? '+' : ''}${ch}%`}</td></tr> })}
              <tr className="border-t border-hair"><td className="py-2.5">Saving rate</td><td className="text-right text-ink-subtle">{d.pf.savingRate === null ? '–' : `${Math.round(d.pf.savingRate)}%`}</td><td className="text-right">{d.f.savingRate === null ? '–' : `${Math.round(d.f.savingRate)}%`}</td><td /></tr></tbody></table>
          <p className="text-caption text-ink-faint mt-3">{d.count} transaksi pada periode ini. Transfer antar-akun tidak dihitung.</p>
        </section>
      </div>
    </>
  )
}

function Metric({ label, value, sub, tone, small }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; small?: boolean }) {
  return <div className="card p-4 min-w-0"><p className="text-caption text-ink-subtle">{label}</p><p className={cx('font-semibold mt-1 truncate', small ? 'text-[15px] leading-7' : 'text-[18px]', tone)} style={{ letterSpacing: '-0.3px' }}>{value}</p>{sub && <p className="text-caption text-ink-subtle">{sub}</p>}</div>
}
