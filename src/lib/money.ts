import type { CurrencyCode } from './types'

export const CURRENCIES: Record<CurrencyCode, { name: string; decimals: number; locale: string }> = {
  IDR: { name: 'Rupiah Indonesia', decimals: 0, locale: 'id-ID' },
  USD: { name: 'Dolar AS', decimals: 2, locale: 'en-US' },
  EUR: { name: 'Euro', decimals: 2, locale: 'de-DE' },
  SGD: { name: 'Dolar Singapura', decimals: 2, locale: 'en-SG' },
  MYR: { name: 'Ringgit Malaysia', decimals: 2, locale: 'ms-MY' },
  JPY: { name: 'Yen Jepang', decimals: 0, locale: 'ja-JP' },
  AUD: { name: 'Dolar Australia', decimals: 2, locale: 'en-AU' },
}
export const BASE: CurrencyCode = 'IDR'
export const DEFAULT_RATES: Record<CurrencyCode, number> = { IDR: 1, USD: 16000, EUR: 17500, SGD: 12000, MYR: 3600, JPY: 105, AUD: 10500 }

const dec = (c: CurrencyCode) => CURRENCIES[c].decimals

/**
 * Parse user text such as "1.250.000", "12,50" or "12.5" into integer minor units
 * using string arithmetic only (no floating-point). Returns null when invalid.
 */
export function parseMinor(input: string, currency: CurrencyCode = BASE): number | null {
  const d = dec(currency)
  let s = input.replace(/[^\d.,]/g, '')
  if (!s) return null
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',')
  const last = Math.max(lastDot, lastComma)
  let intPart = s, frac = ''
  if (last >= 0 && d > 0) {
    const after = s.length - last - 1
    const sep = s[last]
    const sepCount = s.split(sep).length - 1
    const otherSep = s.includes(sep === '.' ? ',' : '.')
    // A single separator followed by 1..d digits is a decimal point; otherwise it groups thousands.
    if (after >= 1 && after <= d && sepCount === 1 && (otherSep || after !== 3 || d !== 3)) {
      intPart = s.slice(0, last); frac = s.slice(last + 1)
    }
  }
  intPart = intPart.replace(/[.,]/g, '')
  if (!intPart && !frac) return null
  const minorStr = (intPart || '0') + frac.padEnd(d, '0').slice(0, d)
  const n = Number(minorStr)
  return Number.isSafeInteger(n) ? n : null
}

/** Integer minor units → plain decimal string for editing (no grouping). */
export function minorToInput(minor: number, currency: CurrencyCode = BASE): string {
  const d = dec(currency)
  if (d === 0) return String(Math.trunc(minor))
  const neg = minor < 0
  const s = String(Math.abs(minor)).padStart(d + 1, '0')
  const out = `${s.slice(0, -d)}.${s.slice(-d)}`.replace(/\.?0+$/, '')
  return (neg ? '-' : '') + out
}

export function formatMoney(minor: number, currency: CurrencyCode = BASE, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const d = dec(currency)
  const v = minor / 10 ** d
  const body = opts.compact && Math.abs(v) >= 1e6
    ? new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(v))
    : new Intl.NumberFormat(CURRENCIES[currency].locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v))
  const sym = currency === 'IDR' ? 'Rp' : currency
  const sign = minor < 0 ? '−' : opts.sign && minor > 0 ? '+' : ''
  return `${sign}${sym}${currency === 'IDR' ? '' : ' '}${body}`
}

/** Convert between currencies using IDR-per-unit rates; result is rounded to whole minor units. */
export function convert(minor: number, from: CurrencyCode, to: CurrencyCode, rates: Partial<Record<CurrencyCode, number>>): number {
  if (from === to) return minor
  const r = (c: CurrencyCode) => (c === BASE ? 1 : rates[c] ?? DEFAULT_RATES[c])
  const major = minor / 10 ** dec(from)
  return Math.round((major * r(from)) / r(to) * 10 ** dec(to))
}

/** Sum integers safely (all inputs are integers, so this is exact). */
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
