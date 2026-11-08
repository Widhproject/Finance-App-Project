import type { Account, Category, Transaction, TxType } from './types'
import { parseCsv } from './csv'
import { parseMinor } from './money'
import { PALETTE, uid } from './defaults'

export interface ImportResult { valid: Transaction[]; newCategories: Category[]; errors: { row: number; message: string }[]; duplicates: number }

const ALIAS: Record<string, string[]> = {
  date: ['tanggal', 'date', 'tgl', 'waktu'], type: ['jenis', 'type', 'tipe'], name: ['nama', 'name', 'keterangan', 'deskripsi', 'description'],
  category: ['kategori', 'category'], account: ['akun', 'account', 'sumber'], to: ['akun tujuan', 'tujuan', 'to', 'to account'],
  amount: ['nominal', 'amount', 'jumlah'], received: ['nominal diterima', 'diterima'], note: ['catatan', 'note', 'notes'],
}
const TYPES: Record<string, TxType> = { pemasukan: 'income', income: 'income', masuk: 'income', pengeluaran: 'expense', expense: 'expense', keluar: 'expense', transfer: 'transfer' }

function parseDate(s: string): Date | null {
  s = s.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (m) return mk(+m[1], +m[2], +m[3], +(m[4] ?? 12), +(m[5] ?? 0))
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (m) return mk(+m[3], +m[2], +m[1], +(m[4] ?? 12), +(m[5] ?? 0))
  return null
}
function mk(y: number, mo: number, d: number, h: number, mi: number) { const x = new Date(y, mo - 1, d, h, mi); return x.getMonth() === mo - 1 && x.getDate() === d ? x : null }

export function parseTransactionsCsv(text: string, accounts: Account[], categories: Category[], existing: Transaction[]): ImportResult {
  const rows = parseCsv(text), res: ImportResult = { valid: [], newCategories: [], errors: [], duplicates: 0 }
  if (rows.length < 2) { res.errors.push({ row: 1, message: 'File kosong atau tidak memiliki baris data.' }); return res }
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (k: string) => head.findIndex((h) => ALIAS[k].includes(h))
  const idx = Object.fromEntries(Object.keys(ALIAS).map((k) => [k, col(k)])) as Record<string, number>
  for (const need of ['date', 'name', 'account', 'amount']) if (idx[need] < 0) { res.errors.push({ row: 1, message: `Kolom "${ALIAS[need][0]}" tidak ditemukan pada header.` }); return res }
  const sig = (t: Transaction) => `${t.date.slice(0, 16)}|${t.name.toLowerCase()}|${t.amount}|${t.accountId}|${t.type}`
  const seen = new Set(existing.map(sig)), cats = [...categories]
  rows.slice(1).forEach((r, i) => {
    const row = i + 2, get = (k: string) => (idx[k] >= 0 ? (r[idx[k]] ?? '').trim() : '')
    const date = parseDate(get('date')), acc = accounts.find((a) => a.name.toLowerCase() === get('account').toLowerCase())
    const type: TxType = TYPES[get('type').toLowerCase()] ?? 'expense'
    if (!date) return res.errors.push({ row, message: 'Tanggal tidak valid (gunakan YYYY-MM-DD atau DD/MM/YYYY).' }) as never
    if (!acc) return res.errors.push({ row, message: `Akun "${get('account')}" tidak ditemukan. Buat akun terlebih dahulu.` }) as never
    const amount = parseMinor(get('amount').replace(/^-/, ''), acc.currency)
    if (!amount || amount <= 0) return res.errors.push({ row, message: 'Nominal tidak valid.' }) as never
    if (!get('name')) return res.errors.push({ row, message: 'Nama transaksi kosong.' }) as never
    let to: Account | undefined, toAmount: number | undefined
    if (type === 'transfer') {
      to = accounts.find((a) => a.name.toLowerCase() === get('to').toLowerCase())
      if (!to || to.id === acc.id) return res.errors.push({ row, message: 'Akun tujuan transfer tidak valid.' }) as never
      toAmount = parseMinor(get('received'), to.currency) ?? (to.currency === acc.currency ? amount : undefined)
      if (!toAmount) return res.errors.push({ row, message: 'Nominal diterima wajib diisi untuk transfer beda mata uang.' }) as never
    }
    let categoryId: string | undefined
    if (type !== 'transfer') {
      const cn = get('category'), kind = type === 'income' ? 'income' : 'expense'
      let c = cats.find((x) => x.type === kind && x.name.toLowerCase() === cn.toLowerCase())
      if (!c && cn) { c = { id: uid(), name: cn, type: kind, color: PALETTE[cats.length % PALETTE.length] }; cats.push(c); res.newCategories.push(c) }
      categoryId = c?.id ?? (kind === 'income' ? 'inc-lain' : 'exp-lain')
    }
    const now = new Date().toISOString()
    const t: Transaction = { id: uid(), type, name: get('name'), amount, accountId: acc.id, toAccountId: to?.id, toAmount, categoryId, date: date.toISOString(), note: get('note'), createdAt: now, updatedAt: now }
    if (seen.has(sig(t))) { res.duplicates++; return }
    seen.add(sig(t)); res.valid.push(t)
  })
  return res
}
