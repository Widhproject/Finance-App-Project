import { useMemo } from 'react'
import { useApp } from '../store/AppStore'
import { budgetStatuses, expenseByCategory, inRange } from '../lib/calc'
import { dueOccurrences } from '../lib/recurring'
import { todayKey } from '../lib/dates'

export interface AlertItem { id: string; tone: 'warn' | 'bad' | 'info'; text: string; to: string }

/** Notification list: budgets at ≥80%, recurring items waiting for confirmation, goals near their deadline. */
export function useAlerts(): AlertItem[] {
  const { budgets, categories, transactions, accounts, settings, period, recurring, goals } = useApp()
  return useMemo(() => {
    const out: AlertItem[] = []
    const spent = expenseByCategory(inRange(transactions, period), accounts, settings.rates)
    for (const s of budgetStatuses(budgets, categories, spent)) {
      if (s.level >= 1) out.push({ id: 'b' + s.budget.id, tone: s.level >= 2 ? 'bad' : 'warn', to: '/anggaran', text: `Anggaran ${s.category?.name ?? ''} ${s.level === 3 ? 'terlampaui' : s.level === 2 ? 'sudah 100%' : `terpakai ${Math.round(s.percent)}%`}.` })
    }
    const due = recurring.reduce((n, r) => n + dueOccurrences(r, todayKey()).length, 0)
    if (due > 0) out.push({ id: 'rec', tone: 'info', to: '/berulang', text: `${due} transaksi berulang menunggu konfirmasi.` })
    for (const g of goals) {
      const got = g.entries.reduce((a, e) => a + e.amount, 0)
      if (g.deadline && got < g.target) {
        const days = Math.ceil((+new Date(g.deadline + 'T23:59:59') - Date.now()) / 864e5)
        if (days >= 0 && days <= 14) out.push({ id: 'g' + g.id, tone: 'warn', to: '/target', text: `Target “${g.name}” berakhir ${days === 0 ? 'hari ini' : `${days} hari lagi`}.` })
      }
    }
    return out
  }, [budgets, categories, transactions, accounts, settings.rates, period, recurring, goals])
}
