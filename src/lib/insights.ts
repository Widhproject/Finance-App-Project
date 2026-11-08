import type { Account, Budget, Category, Settings, Transaction } from './types'
import { budgetStatuses, dailyTotals, expenseByCategory, flowOf, inRange } from './calc'
import { formatMoney } from './money'
import { formatDate, periodByKey, shiftPeriodKey, daysInPeriod } from './dates'

export interface Insight { id: string; tone: 'good' | 'warn' | 'info'; text: string }

interface Input {
  periodKey: string
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  settings: Settings
}

/** Every sentence below is derived from real transactions; nothing is randomised. */
export function buildInsights({ periodKey, accounts, transactions, categories, budgets, settings }: Input): Insight[] {
  const sd = settings.monthStartDay, rates = settings.rates
  const cur = periodByKey(periodKey, sd), prev = periodByKey(shiftPeriodKey(periodKey, -1), sd)
  const curTx = inRange(transactions, cur), prevTx = inRange(transactions, prev)
  const out: Insight[] = []
  if (curTx.length === 0) return [{ id: 'empty', tone: 'info', text: 'Belum ada transaksi pada periode ini. Insight muncul setelah kamu mencatat transaksi.' }]

  const flow = flowOf(curTx, accounts, rates), prevFlow = flowOf(prevTx, accounts, rates)
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Tanpa kategori'

  // Category movements vs previous period
  const curCat = expenseByCategory(curTx, accounts, rates), prevCat = expenseByCategory(prevTx, accounts, rates)
  const moves = [...curCat.entries()]
    .filter(([k, v]) => (prevCat.get(k) ?? 0) > 0 && v > 0)
    .map(([k, v]) => ({ k, v, change: ((v - prevCat.get(k)!) / prevCat.get(k)!) * 100 }))
    .filter((m) => Math.abs(m.change) >= 10)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 2)
  for (const m of moves) {
    out.push({
      id: `cat-${m.k}`, tone: m.change > 0 ? 'warn' : 'good',
      text: `Pengeluaran ${name(m.k).toLowerCase()} ${periodKey === cur.key ? 'periode ini' : 'pada periode ini'} ${m.change > 0 ? 'naik' : 'turun'} ${Math.round(Math.abs(m.change))}% dibandingkan periode sebelumnya.`,
    })
  }

  // Budgets
  for (const s of budgetStatuses(budgets, categories, curCat)) {
    const n = s.category?.name.toLowerCase() ?? 'kategori'
    if (s.level === 3) out.push({ id: `b-${s.budget.id}`, tone: 'warn', text: `Anggaran ${n} terlampaui ${Math.round(s.percent - 100)}% (${formatMoney(-s.remaining)} di atas batas).` })
    else if (s.level >= 1) out.push({ id: `b-${s.budget.id}`, tone: 'warn', text: `Pengeluaran ${n} telah menggunakan ${Math.round(s.percent)}% dari anggaran bulanan.` })
  }

  // Saving rate
  if (flow.savingRate !== null) {
    const r = Math.round(flow.savingRate)
    out.push(r >= 0
      ? { id: 'saving', tone: r >= 20 ? 'good' : 'info', text: `Kamu berhasil menyimpan ${r}% dari total pemasukan periode ini.` }
      : { id: 'saving', tone: 'warn', text: `Pengeluaran melebihi pemasukan sebesar ${formatMoney(-flow.net)} pada periode ini.` })
  } else if (flow.expense > 0) out.push({ id: 'saving', tone: 'warn', text: 'Ada pengeluaran, tetapi belum ada pemasukan tercatat pada periode ini.' })

  // Spending pace vs last period
  if (prevFlow.expense > 0 && flow.expense > 0) {
    const ch = ((flow.expense - prevFlow.expense) / prevFlow.expense) * 100
    if (Math.abs(ch) >= 5) out.push({ id: 'pace', tone: ch > 0 ? 'warn' : 'good', text: `Total pengeluaran ${ch > 0 ? 'naik' : 'turun'} ${Math.round(Math.abs(ch))}% dari periode sebelumnya (${formatMoney(prevFlow.expense)} → ${formatMoney(flow.expense)}).` })
  }

  // Top day & category
  const days = [...dailyTotals(curTx, accounts, rates).entries()].filter(([, v]) => v.expense > 0).sort((a, b) => b[1].expense - a[1].expense)
  if (days[0]) out.push({ id: 'topday', tone: 'info', text: `Hari dengan pengeluaran tertinggi: ${formatDate(days[0][0] + 'T12:00:00')} sebesar ${formatMoney(days[0][1].expense)}.` })
  const top = [...curCat.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top && flow.expense > 0) out.push({ id: 'topcat', tone: 'info', text: `${name(top[0])} adalah pengeluaran terbesar: ${Math.round((top[1] / flow.expense) * 100)}% dari total (${formatMoney(top[1])}).` })
  const pDays = daysInPeriod(cur)
  if (flow.expense > 0 && periodKey === cur.key) {
    const elapsed = Math.max(1, Math.min(pDays, Math.ceil((Date.now() - cur.start.getTime()) / 864e5)))
    out.push({ id: 'avg', tone: 'info', text: `Rata-rata pengeluaran harian ${formatMoney(Math.round(flow.expense / elapsed))}.` })
  }
  return out
}
