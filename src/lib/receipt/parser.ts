import type { ReceiptItem } from '../types'
import { suggestCategoryId } from './category'

export interface TotalCandidate { value: number; label: string; score: number; reasons: string[] }
export interface ParsedReceipt {
  merchant: string
  date?: string // YYYY-MM-DD
  time?: string // HH:MM
  items: ReceiptItem[]
  subtotal?: number
  discount?: number
  tax?: number
  extra?: number
  total?: number
  cash?: number
  change?: number
  candidates: TotalCandidate[]
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
  categoryId?: string
}

/* ---------- amounts ---------- */

/** "125.000", "125,000", "125.000,00", "Rp 12.500" → integer rupiah. */
export function parseAmount(tok: string): number | null {
  const s = tok.replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return null
  const frac = s.match(/^(\d[\d.,]*?)[.,](\d{1,2})$/)
  // Trailing 1–2 digits after a separator are decimals: "125.000,00", "12.50".
  if (frac && (/[.,]/.test(frac[1]) || (frac[1].length <= 3 && frac[2].length === 2))) {
    const n = Number(frac[1].replace(/[.,]/g, ''))
    return Number.isSafeInteger(n) ? n + (Number(frac[2].padEnd(2, '0')) >= 50 ? 1 : 0) : null
  }
  const n = Number(s.replace(/[.,]/g, ''))
  return Number.isSafeInteger(n) ? n : null
}

/** OCR often reads 0 as O, 1 as l/I, 5 as S inside numbers. Only touch tokens that are mostly digits. */
const MONEY_LIKE = /^(?:rp\.?)?[\dOolI|SB]{1,3}(?:[.,][\dOolI|SB]{2,3})+$/i
const DATE_LIKE = /^[\dOolI]{1,2}[/\-.][\dOolI]{1,2}[/\-.][\dOolI]{2,4}$/
function fixDigits(tok: string): string {
  const digits = (tok.match(/\d/g) ?? []).length
  const numeric = digits >= 1 && (MONEY_LIKE.test(tok) || DATE_LIKE.test(tok))
  if (!numeric && (digits < 2 || digits / tok.length < 0.6)) return tok
  return tok.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/B/g, '8')
}
const NUM_TOKEN = /(?:rp\.?\s*)?-?\(?\d[\d.,]*\d\)?|\d/gi

export function numbersIn(line: string): { value: number; index: number; raw: string }[] {
  const fixed = line.split(/(\s+)/).map(fixDigits).join('')
  const out: { value: number; index: number; raw: string }[] = []
  for (const m of fixed.matchAll(NUM_TOKEN)) {
    const v = parseAmount(m[0]); if (v !== null) out.push({ value: v, index: m.index ?? 0, raw: m[0] })
  }
  return out
}
const lastAmount = (line: string, min = 100) => [...numbersIn(line)].reverse().find((n) => n.value >= min)?.value

/* ---------- keywords ---------- */
const RX = {
  grand: /grand\s*total|total\s*bayar|total\s*pembayaran|total\s*belanja|total\s*tagihan|total\s*akhir|total\s*harga|net\s*total|jumlah\s*bayar|jumlah\s*tagihan|amount\s*due|total\s*due|harus\s*dibayar/i,
  total: /^[^a-z]*(total|jumlah|ttl|jml)\b/i,
  totalExclude: /total\s*(item|qty|barang|diskon|disc|hemat|potongan|ppn|pajak|saving|point|poin)|jumlah\s*(item|barang|qty)/i,
  subtotal: /sub\s*-?\s*total/i,
  tax: /\b(ppn|pb1|pajak|tax|vat)\b/i,
  extra: /service|servis|biaya\s*(layanan|admin|pengiriman|kirim)|admin\s*fee|ongkir|ongkos\s*kirim|packing|pembulatan/i,
  discount: /disk(on)?\b|potongan|promo|hemat|voucher|diskon|\bdisc\b/i,
  cash: /\b(tunai|cash|dibayar|uang\s*diterima|bayar|debit|kartu\s*kredit|credit|qris|e-?money|flazz|gopay|ovo|dana|shopeepay|linkaja)\b/i,
  change: /kembali(an)?|\bchange\b|\bkmbl\b/i,
  header: /\b(jl|jalan|telp|tel|hp|npwp|kasir|cashier|struk|nota|invoice|no\.?\s*struk|trx|kec|kel|rt|rw|www|http|terima\s*kasih|thank|selamat|layanan\s*konsumen|kritik|saran)\b/i,
}

/* ---------- date & time ---------- */
const MONTH_IDX: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 }
const validDate = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y >= 2000 && dt.getTime() <= Date.now() + 864e5
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const yr = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s))

export function findDate(text: string): string | undefined {
  let m: RegExpMatchArray | null
  if ((m = text.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/)) && validDate(+m[1], +m[2], +m[3])) return iso(+m[1], +m[2], +m[3])
  for (const mm of text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/g)) {
    let d = +mm[1], mo = +mm[2]; const y = yr(mm[3])
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]
    if (validDate(y, mo, d)) return iso(y, mo, d)
  }
  for (const mm of text.matchAll(/\b(\d{1,2})[\s\-]*([a-z]{3})[a-z]*\.?[\s,\-]*(\d{4}|\d{2})\b/gi)) {
    const mo = MONTH_IDX[mm[2].toLowerCase()]
    if (mo && validDate(yr(mm[3]), mo, +mm[1])) return iso(yr(mm[3]), mo, +mm[1])
  }
  return undefined
}
export function findTime(text: string): string | undefined {
  const m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined
}

/* ---------- merchant ---------- */
const KNOWN: [RegExp, string][] = [
  [/indomaret/i, 'Indomaret'], [/alfamidi/i, 'Alfamidi'], [/alfamart|alfa\s*mart/i, 'Alfamart'], [/super\s*indo/i, 'Superindo'], [/hypermart/i, 'Hypermart'],
  [/transmart/i, 'Transmart'], [/lotte\s*mart/i, 'Lotte Mart'], [/giant/i, 'Giant'], [/carrefour/i, 'Carrefour'], [/lawson/i, 'Lawson'], [/familymart/i, 'FamilyMart'],
  [/starbucks/i, 'Starbucks'], [/kfc/i, 'KFC'], [/mcdonald/i, "McDonald's"], [/burger\s*king/i, 'Burger King'], [/pizza\s*hut/i, 'Pizza Hut'],
  [/kimia\s*farma/i, 'Kimia Farma'], [/guardian/i, 'Guardian'], [/century/i, 'Century'], [/pertamina/i, 'Pertamina'], [/\bshell\b/i, 'Shell'],
]
function titleCase(s: string) { return s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, b) => a + b.toUpperCase()) }

export function findMerchant(lines: string[]): string {
  const head = lines.slice(0, 12).join('\n')
  for (const [rx, name] of KNOWN) if (rx.test(head)) return name
  for (const l of lines.slice(0, 7)) {
    const letters = (l.match(/[A-Za-z]/g) ?? []).length
    if (letters >= 3 && letters / l.replace(/\s/g, '').length >= 0.6 && !RX.header.test(l) && !findDate(l) && !/\d{5,}/.test(l)) return titleCase(l.replace(/[^A-Za-z0-9&'.\- ]/g, ' ').replace(/\s+/g, ' ').trim())
  }
  return ''
}

/* ---------- items ---------- */
const cleanName = (s: string) => s.replace(/^[\d\s.\-*#]{5,}\s+/, '').replace(/[^\p{L}\p{N}&'./%\- ]/gu, ' ').replace(/\s+/g, ' ').trim()
const isKeywordLine = (l: string) => RX.grand.test(l) || RX.total.test(l) || RX.subtotal.test(l) || RX.tax.test(l) || RX.discount.test(l) || RX.cash.test(l) || RX.change.test(l) || RX.extra.test(l) || RX.header.test(l)
const okAmt = (v: number) => v >= 100 && v < 1e9

export function parseItems(lines: string[]): ReceiptItem[] {
  // merge "NAME\n 2 x 5.000   10.000" two-line items
  const merged: string[] = []
  for (const raw of lines) {
    const l = raw.trim()
    if (/^\d+(?:[.,]\d+)?\s*[xX@*]\s*[\d.,]+\s+[\d.,]+$/.test(l) && merged.length) {
      const prev = merged[merged.length - 1]
      if (/[A-Za-z]{2}/.test(prev) && !/[\d.,]{4,}\s*$/.test(prev)) { merged[merged.length - 1] = `${prev} ${l}`; continue }
    }
    merged.push(l)
  }
  const items: ReceiptItem[] = []
  for (const raw of merged) {
    const l = raw.split(/(\s+)/).map(fixDigits).join('')
    if (!l || isKeywordLine(l) || findDate(l) || /\d{9,}/.test(l.replace(/[.,\s]/g, '')) && !/[A-Za-z]{3}/.test(l)) continue
    let m: RegExpMatchArray | null
    let name = '', qty = 1, unit = 0, total = 0
    if ((m = l.match(/^(.*?[A-Za-z].*?)\s+(\d+(?:[.,]\d+)?)\s*[xX*@]\s*([\d.,]+)(?:\s+(-?[\d.,]+))?\s*$/))) {
      name = m[1]; qty = Number(m[2].replace(',', '.')); unit = parseAmount(m[3]) ?? 0; total = m[4] ? parseAmount(m[4]) ?? 0 : Math.round(qty * unit)
    } else if ((m = l.match(/^(.*[A-Za-z].*?)\s+(\d{1,3})\s+([\d.,]{3,})\s+([\d.,]{3,})\s*$/))) {
      name = m[1]; qty = Number(m[2]); unit = parseAmount(m[3]) ?? 0; total = parseAmount(m[4]) ?? 0
      if (Math.abs(qty * unit - total) > Math.max(2, total * 0.02)) { unit = Math.round(total / qty) }
    } else if ((m = l.match(/^(\d{1,3})\s*[xX]?\s+([A-Za-z].*?)\s+([\d.,]{3,})\s*$/))) {
      qty = Number(m[1]); name = m[2]; total = parseAmount(m[3]) ?? 0; unit = Math.round(total / qty)
    } else if ((m = l.match(/^(.*[A-Za-z].*?)\s+([\d.,]{3,})\s*$/))) {
      name = m[1]; total = parseAmount(m[2]) ?? 0; unit = total
    } else continue
    name = cleanName(name)
    if ((name.match(/[A-Za-z]/g) ?? []).length < 2 || !okAmt(total) || qty <= 0 || qty > 999) continue
    items.push({ name, qty, unitPrice: unit, total })
  }
  return items
}

/* ---------- main ---------- */
export function parseReceipt(text: string): ParsedReceipt {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[\t ]+/g, ' ').trim().split(' ').map(fixDigits).join(' ')).filter(Boolean)
  const warnings: string[] = []
  const merchant = findMerchant(lines)
  const date = findDate(lines.join('\n')), time = findTime(lines.join('\n'))

  let subtotal: number | undefined, tax: number | undefined, extra: number | undefined, discount = 0, cash: number | undefined, change: number | undefined
  const raw: { idx: number; value: number; label: string; base: number; reasons: string[] }[] = []

  lines.forEach((line, idx) => {
    const own = lastAmount(line)
    const next = own === undefined && idx + 1 < lines.length && !/[A-Za-z]{3}/.test(lines[idx + 1]) ? lastAmount(lines[idx + 1]) : undefined
    const value = own ?? next
    const penalty = own === undefined ? 10 : 0
    const pos = lines.length > 1 ? idx / (lines.length - 1) : 0
    if (RX.totalExclude.test(line)) return
    if (RX.subtotal.test(line)) { if (value !== undefined) { subtotal = value; raw.push({ idx, value, label: 'Subtotal', base: 30 - penalty + pos * 5, reasons: [] }) } return }
    if (RX.change.test(line)) { if (value !== undefined) change = value; return }
    if (RX.tax.test(line)) { if (value !== undefined) tax = (tax ?? 0) + value; return }
    if (RX.extra.test(line) && !RX.grand.test(line)) { if (value !== undefined) extra = (extra ?? 0) + value; return }
    if (RX.discount.test(line) && !RX.grand.test(line) && !RX.total.test(line)) { if (value !== undefined) discount += value; return }
    if (RX.grand.test(line)) { if (value !== undefined) raw.push({ idx, value, label: line.replace(/[\d.,]+/g, '').replace(/[^A-Za-z ]/g, '').trim() || 'Total', base: 100 - penalty + pos * 10, reasons: [] }); return }
    if (RX.total.test(line)) { if (value !== undefined) raw.push({ idx, value, label: 'Total', base: 70 - penalty + pos * 10, reasons: [] }); return }
    if (RX.cash.test(line)) { if (value !== undefined) cash = Math.max(cash ?? 0, value); return }
  })

  const items = parseItems(lines)
  const itemsSum = items.reduce((a, b) => a + b.total, 0)

  // Merge duplicates by value and add cross-validation evidence.
  const byValue = new Map<number, TotalCandidate>()
  const add = (value: number, label: string, score: number, reason?: string) => {
    if (!okAmt(value)) return
    const c = byValue.get(value)
    if (c) { c.score = Math.max(c.score, score) + 5; if (reason) c.reasons.push(reason); if (!c.label.includes(label)) c.label += ` / ${label}` }
    else byValue.set(value, { value, label, score, reasons: reason ? [reason] : [] })
  }
  raw.forEach((r) => add(r.value, r.label, r.base))
  if (cash !== undefined && change !== undefined && cash > change) add(cash - change, 'Tunai − kembalian', 55)
  if (subtotal !== undefined && (discount || tax || extra)) add(subtotal - discount + (tax ?? 0) + (extra ?? 0), 'Subtotal − diskon + pajak', 50)
  if (items.length >= 2) add(itemsSum - discount, 'Jumlah item', 25)

  const tol = (v: number) => Math.max(1, Math.round(v * 0.001))
  for (const c of byValue.values()) {
    if (cash !== undefined && change !== undefined && Math.abs(cash - change - c.value) <= tol(c.value)) { c.score += 40; c.reasons.push('Cocok dengan tunai − kembalian') }
    if (subtotal !== undefined && Math.abs(subtotal - discount + (tax ?? 0) + (extra ?? 0) - c.value) <= tol(c.value) && (discount || tax || extra)) { c.score += 30; c.reasons.push('Cocok dengan subtotal − diskon + pajak') }
    if (items.length >= 2 && (Math.abs(itemsSum - c.value) <= tol(c.value) || Math.abs(itemsSum - discount + (tax ?? 0) + (extra ?? 0) - c.value) <= tol(c.value))) { c.score += 25; c.reasons.push('Cocok dengan jumlah harga barang') }
    if (cash !== undefined && c.value > cash) { c.score -= 30; c.reasons.push('Lebih besar dari uang yang dibayarkan') }
  }
  if (byValue.size === 0) {
    // Last resort: biggest amounts on the receipt, flagged as low confidence.
    const all = lines.flatMap((l) => numbersIn(l).map((n) => n.value)).filter(okAmt).sort((a, b) => b - a)
    ;[...new Set(all)].slice(0, 4).forEach((v) => add(v, 'Nominal terbesar', 10))
  }
  const candidates = [...byValue.values()].sort((a, b) => b.score - a.score).slice(0, 5)
  const top = candidates[0], second = candidates[1]

  let confidence: ParsedReceipt['confidence'] = 'low'
  if (top) {
    const clear = !second || top.score - second.score >= 25
    if (top.score >= 120 && clear) confidence = 'high'
    else if (top.score >= 90 && clear) confidence = 'medium'
    else if (top.score >= 100) confidence = 'medium'
  }
  let total = confidence === 'low' ? undefined : top?.value // never auto-pick a low-confidence amount
  if (!top) warnings.push('Total pembayaran tidak ditemukan. Isi nominal secara manual.')
  else if (confidence === 'low') warnings.push('Beberapa nominal berpotensi menjadi total. Pilih yang benar.')
  if (!merchant) warnings.push('Nama toko tidak terbaca.')
  if (!date) warnings.push('Tanggal tidak terbaca. Tanggal hari ini dipakai sementara.')
  if (items.length && total !== undefined && itemsSum > 0 && Math.abs(itemsSum - discount + (tax ?? 0) + (extra ?? 0) - total) > Math.max(500, total * 0.03) && Math.abs(itemsSum - total) > Math.max(500, total * 0.03))
    warnings.push('Jumlah harga barang tidak sama dengan total. Periksa daftar barang.')

  return {
    merchant, date, time, items, subtotal, discount: discount || undefined, tax, extra, total, cash, change, candidates, confidence, warnings,
    categoryId: suggestCategoryId(merchant, items.map((i) => i.name)),
  }
}

/** Stable fingerprint used to stop the same receipt being saved twice. */
export function receiptKey(p: { merchant: string; date?: string; time?: string; total: number; itemCount: number }): string {
  const s = `${p.merchant.toLowerCase().replace(/[^a-z0-9]/g, '')}|${p.date ?? ''}|${p.time ?? ''}|${p.total}|${p.itemCount}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return `rc-${h.toString(16)}-${p.total}`
}
