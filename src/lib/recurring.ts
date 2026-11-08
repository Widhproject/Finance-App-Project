import type { Recurring } from './types'
import { dayKey, fromDayKey } from './dates'

/** The n-th occurrence date (0-based) computed from the start date, so month-end days never drift. */
export function occurrenceAt(r: Pick<Recurring, 'frequency' | 'startDate'>, n: number): string {
  const s = fromDayKey(r.startDate)
  switch (r.frequency) {
    case 'daily': return dayKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() + n))
    case 'weekly': return dayKey(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * n))
    case 'monthly': {
      const t = new Date(s.getFullYear(), s.getMonth() + n, 1)
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
      return dayKey(new Date(t.getFullYear(), t.getMonth(), Math.min(s.getDate(), last)))
    }
    case 'yearly': {
      const y = s.getFullYear() + n
      const last = new Date(y, s.getMonth() + 1, 0).getDate()
      return dayKey(new Date(y, s.getMonth(), Math.min(s.getDate(), last)))
    }
  }
}

/** Occurrences up to `today` that have not been posted or skipped yet. */
export function dueOccurrences(r: Recurring, today: string, cap = 500): string[] {
  if (!r.active) return []
  const done = new Set(r.processed)
  const out: string[] = []
  for (let n = 0; n < cap; n++) {
    const d = occurrenceAt(r, n)
    if (d > today) break
    if (r.endDate && d > r.endDate) break
    if (!done.has(d)) out.push(d)
  }
  return out
}

export function nextOccurrence(r: Recurring, today: string): string | null {
  if (!r.active) return null
  const done = new Set(r.processed)
  for (let n = 0; n < 5000; n++) {
    const d = occurrenceAt(r, n)
    if (r.endDate && d > r.endDate) return null
    if (d >= today && !done.has(d)) return d
  }
  return null
}

export const FREQ_LABEL: Record<Recurring['frequency'], string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }
