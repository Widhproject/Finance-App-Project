import type { Account, Settings, Transaction } from './types'
import { flowOf, inRange, netWorthAt } from './calc'
import { monthShort, periodByKey, shiftPeriodKey } from './dates'

export interface SeriesPoint { key: string; label: string; income: number; expense: number; net: number; balance: number }

/** Income, expense and end-of-period net worth for the last `n` financial periods ending at `endKey`. */
export function periodSeries(n: number, endKey: string, accounts: Account[], txns: Transaction[], settings: Settings): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let i = n - 1; i >= 0; i--) {
    const key = shiftPeriodKey(endKey, -i), p = periodByKey(key, settings.monthStartDay)
    const f = flowOf(inRange(txns, p), accounts, settings.rates)
    const upTo = Math.min(p.end.getTime() - 1, Date.now())
    out.push({ key, label: monthShort(p.start.getMonth()), income: f.income, expense: f.expense, net: f.net, balance: netWorthAt(accounts, txns, settings.rates, upTo) })
  }
  return out
}

export const axisMoney = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : ''
  if (a >= 1e9) return `${s}${+(a / 1e9).toFixed(1)}M`
  if (a >= 1e6) return `${s}${+(a / 1e6).toFixed(a >= 1e7 ? 0 : 2)}jt`
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}rb`
  return `${s}${a}`
}
