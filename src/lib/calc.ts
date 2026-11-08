import type { Account, Budget, Category, CurrencyCode, Settings, Transaction } from './types'
import { BASE, convert, pct, sum } from './money'
import { dayKey, inPeriod, type Period } from './dates'

type Rates = Settings['rates']

/** Signed effect of one transaction on one account, in that account's currency. */
export function effectOn(t: Transaction, accountId: string): number {
  if (t.type === 'income') return t.accountId === accountId ? t.amount : 0
  if (t.type === 'expense') return t.accountId === accountId ? -t.amount : 0
  // transfer: out of source, into destination (toAmount handles cross-currency transfers)
  let v = 0
  if (t.accountId === accountId) v -= t.amount
  if (t.toAccountId === accountId) v += t.toAmount ?? t.amount
  return v
}

/** Saldo Akun = Saldo Awal + Pemasukan − Pengeluaran + Transfer Masuk − Transfer Keluar */
export function accountBalance(account: Account, txns: Transaction[], upTo?: number): number {
  let b = account.openingBalance
  for (const t of txns) {
    if (upTo !== undefined && new Date(t.date).getTime() > upTo) continue
    b += effectOn(t, account.id)
  }
  return b
}

export function balanceMap(accounts: Account[], txns: Transaction[]): Map<string, number> {
  const m = new Map(accounts.map((a) => [a.id, a.openingBalance]))
  const add = (id: string | undefined, v: number) => { if (id && m.has(id)) m.set(id, m.get(id)! + v) }
  for (const t of txns) {
    if (t.type === 'income') add(t.accountId, t.amount)
    else if (t.type === 'expense') add(t.accountId, -t.amount)
    else { add(t.accountId, -t.amount); add(t.toAccountId, t.toAmount ?? t.amount) }
  }
  return m
}

export const toBase = (minor: number, cur: CurrencyCode, rates: Rates) => convert(minor, cur, BASE, rates)

export function totalsByKind(accounts: Account[], txns: Transaction[], rates: Rates) {
  const bal = balanceMap(accounts, txns)
  const out = { total: 0, cash: 0, bank: 0, ewallet: 0 }
  for (const a of accounts) {
    const v = toBase(bal.get(a.id) ?? 0, a.currency, rates)
    out.total += v; out[a.kind] += v
  }
  return out
}

export interface Flow { income: number; expense: number; net: number; savingRate: number | null }
/** Income/expense in base currency for a set of transactions. Transfers are excluded by definition. */
export function flowOf(txns: Transaction[], accounts: Account[], rates: Rates): Flow {
  const cur = new Map(accounts.map((a) => [a.id, a.currency]))
  let income = 0, expense = 0
  for (const t of txns) {
    if (t.type === 'transfer') continue
    const v = toBase(t.amount, cur.get(t.accountId) ?? BASE, rates)
    if (t.type === 'income') income += v; else expense += v
  }
  const net = income - expense
  return { income, expense, net, savingRate: income > 0 ? (net / income) * 100 : null }
}

export const inRange = (txns: Transaction[], p: Period) => txns.filter((t) => inPeriod(t.date, p))

export function expenseByCategory(txns: Transaction[], accounts: Account[], rates: Rates): Map<string, number> {
  const cur = new Map(accounts.map((a) => [a.id, a.currency]))
  const m = new Map<string, number>()
  for (const t of txns) {
    if (t.type !== 'expense') continue
    const k = t.categoryId ?? 'none'
    m.set(k, (m.get(k) ?? 0) + toBase(t.amount, cur.get(t.accountId) ?? BASE, rates))
  }
  return m
}

/** Total wealth (base currency) at the end of the given instant. */
export function netWorthAt(accounts: Account[], txns: Transaction[], rates: Rates, upTo: number): number {
  return sum(accounts.map((a) => toBase(accountBalance(a, txns, upTo), a.currency, rates)))
}

export interface BudgetStatus { budget: Budget; category?: Category; spent: number; remaining: number; percent: number; level: 0 | 1 | 2 | 3 }
export const budgetLevel = (percent: number): 0 | 1 | 2 | 3 => (percent > 100 ? 3 : percent >= 100 ? 2 : percent >= 80 ? 1 : 0)

export function budgetStatuses(budgets: Budget[], categories: Category[], spentByCat: Map<string, number>): BudgetStatus[] {
  return budgets.map((b) => {
    const spent = spentByCat.get(b.categoryId) ?? 0
    const percent = pct(spent, b.amount)
    return { budget: b, category: categories.find((c) => c.id === b.categoryId), spent, remaining: b.amount - spent, percent, level: budgetLevel(percent) }
  })
}

/** Day-by-day totals for the calendar and "highest spending day". */
export function dailyTotals(txns: Transaction[], accounts: Account[], rates: Rates) {
  const cur = new Map(accounts.map((a) => [a.id, a.currency]))
  const m = new Map<string, { income: number; expense: number; count: number }>()
  for (const t of txns) {
    const k = dayKey(t.date)
    const e = m.get(k) ?? { income: 0, expense: 0, count: 0 }
    e.count++
    if (t.type !== 'transfer') {
      const v = toBase(t.amount, cur.get(t.accountId) ?? BASE, rates)
      if (t.type === 'income') e.income += v; else e.expense += v
    }
    m.set(k, e)
  }
  return m
}

/** Returns accounts that would end with a negative balance after applying `next` (only those touched by `touched`). */
export function negativeAfter(accounts: Account[], next: Transaction[], touched: string[]): Account[] {
  const bal = balanceMap(accounts, next)
  return accounts.filter((a) => touched.includes(a.id) && (bal.get(a.id) ?? 0) < 0)
}
