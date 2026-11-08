import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { Money, PageHeader, cx } from '../components/ui'
import TxRow from '../components/TxRow'
import { dailyTotals } from '../lib/calc'
import { dayKey, formatDayHeading, monthName, todayKey } from '../lib/dates'
import { axisMoney } from '../lib/series'

const HEAD = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function CalendarPage() {
  const { transactions, accounts, settings } = useApp()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [sel, setSel] = useState(todayKey())

  const totals = useMemo(() => dailyTotals(transactions, accounts, settings.rates), [transactions, accounts, settings.rates])
  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1), lead = (first.getDay() + 6) % 7, n = new Date(ym.y, ym.m + 1, 0).getDate()
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => dayKey(new Date(ym.y, ym.m, i + 1)))]
  }, [ym])
  const shift = (d: number) => { const t = new Date(ym.y, ym.m + d, 1); setYm({ y: t.getFullYear(), m: t.getMonth() }) }
  const dayTx = transactions.filter((t) => dayKey(t.date) === sel).sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const sum = totals.get(sel)
  const hide = settings.hideBalance

  return (
    <>
      <PageHeader title="Kalender" subtitle="Aktivitas keuangan harian." actions={
        <div className="flex items-center gap-1 card px-1 h-11 md:h-10">
          <button className="btn-icon" onClick={() => shift(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={16} /></button>
          <button className="px-2 min-w-[140px] text-center font-medium" onClick={() => { setYm({ y: now.getFullYear(), m: now.getMonth() }); setSel(todayKey()) }}>{monthName(ym.m)} {ym.y}</button>
          <button className="btn-icon" onClick={() => shift(1)} aria-label="Bulan berikutnya"><ChevronRight size={16} /></button>
        </div>} />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        <div className="card p-2 sm:p-3">
          <div className="grid grid-cols-7 mb-1">{HEAD.map((h) => <div key={h} className="text-center text-caption text-ink-subtle py-2">{h}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((k, i) => {
              if (!k) return <div key={i} />
              const t = totals.get(k), isSel = k === sel, today = k === todayKey()
              return (
                <button key={k} onClick={() => setSel(k)} aria-pressed={isSel} aria-label={`${k}${t ? `, ${t.count} transaksi` : ''}`}
                  className={cx('min-h-[64px] sm:min-h-[88px] rounded-md border p-1 sm:p-2 text-left flex flex-col transition-colors', isSel ? 'bg-s3 border-primary' : 'border-hair hover:bg-s2', )}>
                  <span className={cx('text-[12px] sm:text-[13px] font-medium w-6 h-6 flex items-center justify-center rounded-full', today && 'bg-primary text-white')}>{Number(k.slice(8))}</span>
                  {t && (
                    <span className="mt-auto text-[10px] sm:text-[11px] leading-tight num">
                      {t.income > 0 && <span className="block text-income truncate">{hide ? '+•••' : '+' + axisMoney(t.income)}</span>}
                      {t.expense > 0 && <span className="block text-expense truncate">{hide ? '−•••' : '−' + axisMoney(t.expense)}</span>}
                      <span className="hidden sm:block text-ink-faint">{t.count} transaksi</span>
                      <span className="sm:hidden inline-block w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <section className="card self-start">
          <header className="px-4 py-3 border-b border-hair"><h2 className="h2">{formatDayHeading(sel)}</h2>
            <p className="text-caption text-ink-subtle mt-0.5">{sum ? <>Masuk <span className="text-income"><Money minor={sum.income} /></span> · Keluar <Money minor={sum.expense} /> · {sum.count} transaksi</> : 'Tidak ada transaksi'}</p></header>
          {dayTx.length ? dayTx.map((t) => <TxRow key={t.id} t={t} />) : <p className="text-ink-subtle text-center py-10">Tidak ada transaksi pada tanggal ini.</p>}
        </section>
      </div>
    </>
  )
}
