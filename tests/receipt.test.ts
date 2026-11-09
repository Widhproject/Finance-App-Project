import { describe, it, expect } from 'vitest'
import { parseReceipt, parseAmount, receiptKey, findDate } from '../src/lib/receipt/parser'

const INDOMARET = `INDOMARET CIPUTAT
JL. RAYA CIPUTAT NO 12
NPWP 01.234.567.8-901.000
INDOMIE GORENG 5 x 3.500 17.500
AQUA 600ML 2 x 3.500 7.000
SARIMI AYAM BAWANG 3.200
Total Item 8
Total Belanja 27.700
Tunai 50.000
Kembali 22.300
12-03-2025 18:42 KSR:SITI
TERIMA KASIH`

const RESTO = `Warung Makan Bu Sri
Jl. Kebon Jeruk 5
Nasi Goreng Spesial 2 35.000 70.000
Es Teh Manis 2 8.000 16.000
Subtotal 86.000
PPN 10% 8.600
Service 5% 4.300
GRAND TOTAL 98.900
Tunai 100.000
Kembali 1.100
3 Maret 2025 12:15`

describe('parseAmount', () => {
  it('handles Indonesian formats', () => {
    expect(parseAmount('Rp 125.000')).toBe(125000)
    expect(parseAmount('125.000,00')).toBe(125000)
    expect(parseAmount('125,000')).toBe(125000)
    expect(parseAmount('3.500')).toBe(3500)
    expect(parseAmount('abc')).toBeNull()
  })
})

describe('parseReceipt', () => {
  it('reads a convenience-store receipt', () => {
    const r = parseReceipt(INDOMARET)
    expect(r.merchant).toBe('Indomaret')
    expect(r.total).toBe(27700)
    expect(r.cash).toBe(50000); expect(r.change).toBe(22300)
    expect(r.date).toBe('2025-03-12'); expect(r.time).toBe('18:42')
    expect(r.items.map((i) => i.total)).toEqual([17500, 7000, 3200])
    expect(r.items[0]).toMatchObject({ name: 'INDOMIE GORENG', qty: 5, unitPrice: 3500 })
    expect(r.confidence).toBe('high')
    expect(r.categoryId).toBe('exp-belanja')
  })
  it('reads a restaurant receipt with tax and service', () => {
    const r = parseReceipt(RESTO)
    expect(r.total).toBe(98900)
    expect(r.subtotal).toBe(86000); expect(r.tax).toBe(8600); expect(r.extra).toBe(4300)
    expect(r.date).toBe('2025-03-03')
    expect(r.items).toHaveLength(2)
    expect(r.categoryId).toBe('exp-makan')
  })
  it('does not trust a total when candidates conflict', () => {
    const r = parseReceipt(`TOKO ABC\nTotal 45.000\nTotal 54.000\n01/02/2025`)
    expect(r.confidence).toBe('low')
    expect(r.total).toBeUndefined()
    expect(r.candidates.map((c) => c.value).sort()).toEqual([45000, 54000])
  })
  it('recovers total from cash minus change when TOTAL line is unreadable', () => {
    const r = parseReceipt(`APOTEK SEHAT\nObat Batuk 12.500\nVitamin C 27.500\nTunai 50.000\nKembali 10.000\n05-02-2025`)
    expect(r.candidates[0].value).toBe(40000)
    expect(r.categoryId).toBe('exp-kesehatan')
  })
  it('tolerates common OCR digit mistakes', () => {
    const r = parseReceipt(`ALFAMART\nTotal Belanja 3O.5OO\nTunai 5O.OOO\nKembali l9.5OO\n12/03/2O25`)
    expect(r.total).toBe(30500); expect(r.date).toBe('2025-03-12')
  })
  it('returns no total for garbage text instead of guessing', () => {
    const r = parseReceipt('asdf qwer zxcv')
    expect(r.total).toBeUndefined(); expect(r.warnings.length).toBeGreaterThan(0)
  })
  it('builds a stable duplicate key', () => {
    const a = receiptKey({ merchant: 'Indomaret', date: '2025-03-12', time: '18:42', total: 27700, itemCount: 3 })
    expect(a).toBe(receiptKey({ merchant: 'INDOMARET ', date: '2025-03-12', time: '18:42', total: 27700, itemCount: 3 }))
    expect(a).not.toBe(receiptKey({ merchant: 'Indomaret', date: '2025-03-12', time: '18:43', total: 27700, itemCount: 3 }))
  })
  it('rejects impossible dates', () => { expect(findDate('99/99/2025')).toBeUndefined() })
  it('reads two-line items even when OCR adds a colon after x', () => {
    const r = parseReceipt('INDOMARET\nINDOMIE GORENG SPESIAL\n5 x: 3.500   17.500\nTotal Belanja 17.500\n07-11-2026 18:42')
    expect(r.items).toHaveLength(1); expect(r.items[0]).toMatchObject({ qty: 5, unitPrice: 3500, total: 17500 })
  })
  it('does not treat fuel-pump lines as items', () => {
    const r = parseReceipt('PERTAMINA\nProduk PERTALITE\nHarga/Liter 10.000\nVolume (L) 4,50\nTOTAL 45,000\nCash 50.000\nKembali 5.000\n09-11-2026 07:31')
    expect(r.items).toHaveLength(0); expect(r.total).toBe(45000)
  })
})
