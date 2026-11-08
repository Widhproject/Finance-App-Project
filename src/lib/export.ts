import type { Account, Category, Settings, Transaction } from './types'
import { toCsv } from './csv'
import { minorToInput, formatMoney } from './money'
import { flowOf } from './calc'
import { dayKey, formatTime } from './dates'

export const CSV_HEADER = ['Tanggal', 'Jenis', 'Nama', 'Kategori', 'Akun', 'Akun tujuan', 'Nominal', 'Mata uang', 'Nominal diterima', 'Catatan']
const TYPE_LABEL = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer' }

export function transactionRows(txns: Transaction[], accounts: Account[], categories: Category[]): (string | number)[][] {
  const a = new Map(accounts.map((x) => [x.id, x])), c = new Map(categories.map((x) => [x.id, x.name]))
  return [...txns].sort((x, y) => +new Date(x.date) - +new Date(y.date)).map((t) => {
    const from = a.get(t.accountId), to = t.toAccountId ? a.get(t.toAccountId) : undefined
    return [`${dayKey(t.date)} ${formatTime(t.date)}`, TYPE_LABEL[t.type], t.name, t.categoryId ? c.get(t.categoryId) ?? '' : '', from?.name ?? '', to?.name ?? '',
      minorToInput(t.amount, from?.currency), from?.currency ?? 'IDR', t.type === 'transfer' ? minorToInput(t.toAmount ?? t.amount, to?.currency) : '', t.note]
  })
}

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type })), a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const exportCsv = (rows: (string | number)[][], name: string) => download(`${name}.csv`, toCsv([CSV_HEADER, ...rows]), 'text/csv;charset=utf-8')

export async function exportXlsx(rows: (string | number)[][], accounts: Account[], balances: Map<string, number>, name: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const body = rows.map((r) => r.map((v, i) => ((i === 6 || i === 8) && v !== '' ? Number(v) : v)))
  const ws = XLSX.utils.aoa_to_sheet([CSV_HEADER, ...body]); ws['!cols'] = [16, 12, 28, 22, 16, 16, 14, 10, 16, 30].map((wch) => ({ wch }))
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
  const acc = XLSX.utils.aoa_to_sheet([['Akun', 'Jenis', 'Mata uang', 'Saldo awal', 'Saldo saat ini'], ...accounts.map((a) => [a.name, a.kind, a.currency, Number(minorToInput(a.openingBalance, a.currency)), Number(minorToInput(balances.get(a.id) ?? 0, a.currency))])])
  acc['!cols'] = [20, 10, 10, 16, 16].map((wch) => ({ wch })); XLSX.utils.book_append_sheet(wb, acc, 'Akun')
  XLSX.writeFile(wb, `${name}.xlsx`)
}

export async function exportPdf(txns: Transaction[], accounts: Account[], categories: Category[], balances: Map<string, number>, settings: Settings, title: string, name: string) {
  const [{ jsPDF }, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable').then((m) => m.default)])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const f = flowOf(txns, accounts, settings.rates)
  doc.setFontSize(16); doc.text('Laporan Keuangan', 40, 44)
  doc.setFontSize(10); doc.setTextColor(110); doc.text(`${title} · dibuat ${dayKey(new Date())}`, 40, 62); doc.setTextColor(0)
  autoTable(doc, { startY: 78, head: [['Pemasukan', 'Pengeluaran', 'Arus kas bersih', 'Saving rate']], body: [[formatMoney(f.income), formatMoney(f.expense), formatMoney(f.net), f.savingRate === null ? '-' : `${Math.round(f.savingRate)}%`]], theme: 'grid', headStyles: { fillColor: [94, 106, 210] }, styles: { fontSize: 10 } })
  autoTable(doc, { head: [['Akun', 'Jenis', 'Saldo']], body: accounts.map((a) => [a.name, a.kind, formatMoney(balances.get(a.id) ?? 0, a.currency)]), theme: 'striped', headStyles: { fillColor: [94, 106, 210] }, styles: { fontSize: 9 }, margin: { top: 20 } })
  const rows = transactionRows(txns, accounts, categories)
  autoTable(doc, { head: [['Tanggal', 'Jenis', 'Nama', 'Kategori', 'Akun', 'Tujuan', 'Nominal', 'Cur']], body: rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], Number(r[6]).toLocaleString('id-ID'), r[7]]), theme: 'striped', headStyles: { fillColor: [94, 106, 210] }, styles: { fontSize: 8 }, columnStyles: { 6: { halign: 'right' } }, margin: { top: 20 } })
  doc.save(`${name}.pdf`)
}
