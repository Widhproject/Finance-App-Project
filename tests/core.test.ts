import { describe, it, expect } from 'vitest'
import { parseMinor, minorToInput, formatMoney, convert } from '../src/lib/money'
import { accountBalance, balanceMap, flowOf, netWorthAt, totalsByKind, negativeAfter, budgetLevel } from '../src/lib/calc'
import { occurrenceAt, dueOccurrences } from '../src/lib/recurring'
import { periodFor, periodByKey, shiftPeriodKey } from '../src/lib/dates'
import { hashPin, verifyPin } from '../src/lib/crypto'
import { parseCsv, toCsv } from '../src/lib/csv'
import type { Account, Transaction, Recurring } from '../src/lib/types'

const acc = (id: string, kind: Account['kind'], opening: number, currency: Account['currency'] = 'IDR'): Account => ({ id, name: id, kind, currency, openingBalance: opening, color: '#fff', createdAt: '2025-01-01T00:00:00Z' })
let n = 0
const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'accountId'>): Transaction => ({ id: 't' + n++, name: 'x', date: '2025-03-10T10:00:00.000Z', note: '', createdAt: '', updatedAt: '', ...p })

describe('money', () => {
  it('parses rupiah text without floats', () => {
    expect(parseMinor('1.250.000')).toBe(1250000)
    expect(parseMinor('Rp 500.000')).toBe(500000)
    expect(parseMinor('')).toBeNull()
  })
  it('parses decimals for 2-decimal currencies', () => {
    expect(parseMinor('12,50', 'USD')).toBe(1250)
    expect(parseMinor('1,234.56', 'USD')).toBe(123456)
    expect(parseMinor('1.234,5', 'USD')).toBe(123450)
    expect(parseMinor('1,234', 'USD')).toBe(123400)
    expect(minorToInput(1250, 'USD')).toBe('12.5')
  })
  it('avoids the 0.1+0.2 problem', () => {
    expect(parseMinor('0,10', 'USD')! + parseMinor('0,20', 'USD')!).toBe(30)
  })
  it('formats and converts', () => {
    expect(formatMoney(1500000)).toContain('1.500.000')
    expect(formatMoney(-5000)).toMatch(/^−Rp/)
    expect(convert(1000, 'USD', 'IDR', { USD: 16000 })).toBe(160000) // $10.00 → Rp160.000
    expect(convert(160000, 'IDR', 'USD', { USD: 16000 })).toBe(1000)
  })
})

describe('balances', () => {
  const accounts = [acc('cash', 'cash', 1_000_000), acc('bca', 'bank', 2_000_000), acc('dana', 'ewallet', 0)]
  it('transfer moves money without changing wealth or flow', () => {
    const txns = [tx({ type: 'transfer', amount: 500_000, accountId: 'cash', toAccountId: 'bca' })]
    const b = balanceMap(accounts, txns)
    expect(b.get('cash')).toBe(500_000)
    expect(b.get('bca')).toBe(2_500_000)
    expect(totalsByKind(accounts, txns, {}).total).toBe(3_000_000)
    const f = flowOf(txns, accounts, {})
    expect(f.income).toBe(0); expect(f.expense).toBe(0)
  })
  it('implements Saldo Akun formula', () => {
    const txns = [
      tx({ type: 'income', amount: 3_000_000, accountId: 'bca' }),
      tx({ type: 'expense', amount: 400_000, accountId: 'bca' }),
      tx({ type: 'transfer', amount: 100_000, accountId: 'bca', toAccountId: 'dana' }),
      tx({ type: 'transfer', amount: 50_000, accountId: 'cash', toAccountId: 'bca' }),
    ]
    expect(accountBalance(accounts[1], txns)).toBe(2_000_000 + 3_000_000 - 400_000 - 100_000 + 50_000)
    expect(accountBalance(accounts[2], txns)).toBe(100_000)
  })
  it('editing/deleting transactions is reflected because balances are derived', () => {
    const t = tx({ type: 'expense', amount: 200_000, accountId: 'cash' })
    expect(accountBalance(accounts[0], [t])).toBe(800_000)
    expect(accountBalance(accounts[0], [{ ...t, amount: 300_000 }])).toBe(700_000)
    expect(accountBalance(accounts[0], [])).toBe(1_000_000)
  })
  it('cross-currency transfer keeps both sides exact', () => {
    const a = [acc('idr', 'bank', 10_000_000), acc('usd', 'bank', 0, 'USD')]
    const t = tx({ type: 'transfer', amount: 1_600_000, accountId: 'idr', toAccountId: 'usd', toAmount: 10000 })
    const b = balanceMap(a, [t])
    expect(b.get('idr')).toBe(8_400_000); expect(b.get('usd')).toBe(10000)
    expect(totalsByKind(a, [t], { USD: 16000 }).total).toBe(8_400_000 + 1_600_000)
  })
  it('net worth over time and saving rate', () => {
    const txns = [tx({ type: 'income', amount: 1_000_000, accountId: 'cash', date: '2025-03-05T00:00:00Z' }), tx({ type: 'expense', amount: 250_000, accountId: 'cash', date: '2025-03-20T00:00:00Z' })]
    expect(netWorthAt(accounts, txns, {}, Date.parse('2025-03-10T00:00:00Z'))).toBe(4_000_000)
    expect(flowOf(txns, accounts, {}).savingRate).toBe(75)
  })
  it('detects negative balances', () => {
    const txns = [tx({ type: 'expense', amount: 1_500_000, accountId: 'cash' })]
    expect(negativeAfter(accounts, txns, ['cash']).map((a) => a.id)).toEqual(['cash'])
    expect(negativeAfter(accounts, txns, ['bca'])).toEqual([])
  })
  it('budget levels', () => { expect([50, 80, 99.9, 100, 100.1].map(budgetLevel)).toEqual([0, 1, 1, 2, 3]) })
})

describe('periods & recurring', () => {
  it('handles custom month start', () => {
    const p = periodFor(new Date(2025, 2, 10), 25) // Mar 10 with start day 25 → period from Feb 25
    expect(p.key).toBe('2025-02'); expect(p.start.getDate()).toBe(25); expect(p.end.getMonth()).toBe(2)
    expect(shiftPeriodKey('2025-01', -1)).toBe('2024-12')
    expect(periodByKey('2025-03', 1).label).toBe('Maret 2025')
  })
  it('monthly occurrences clamp to month end without drifting', () => {
    const r = { frequency: 'monthly', startDate: '2025-01-31' } as const
    expect([0, 1, 2, 3].map((i) => occurrenceAt(r, i))).toEqual(['2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30'])
  })
  it('does not re-issue processed occurrences', () => {
    const r: Recurring = { id: 'r', name: 'Kos', type: 'expense', amount: 1, accountId: 'a', note: '', frequency: 'monthly', startDate: '2025-01-05', active: true, processed: ['2025-01-05', '2025-02-05'], createdAt: '' }
    expect(dueOccurrences(r, '2025-04-10')).toEqual(['2025-03-05', '2025-04-05'])
    expect(dueOccurrences({ ...r, endDate: '2025-03-31' }, '2025-04-10')).toEqual(['2025-03-05'])
    expect(dueOccurrences({ ...r, active: false }, '2025-04-10')).toEqual([])
  })
})

describe('pin & csv', () => {
  it('hashes and verifies a PIN without storing it', async () => {
    const h = await hashPin('123456')
    expect(JSON.stringify(h)).not.toContain('123456')
    expect(await verifyPin('123456', h)).toBe(true)
    expect(await verifyPin('123457', h)).toBe(false)
  })
  it('round-trips CSV with quotes and commas', () => {
    const rows = [['a', 'b,c', 'd"e'], ['1', '2', 'x\ny']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

import { transactionRows, CSV_HEADER } from '../src/lib/export'
import { parseTransactionsCsv } from '../src/lib/importCsv'
import { DEFAULT_CATEGORIES } from '../src/lib/defaults'

describe('csv export → import round trip', () => {
  const accounts = [acc('Dompet', 'cash', 0), acc('BCA', 'bank', 0)]
  const txns = [
    tx({ type: 'expense', amount: 25000, accountId: 'Dompet', name: 'Makan, siang', categoryId: 'exp-makan', date: '2025-03-10T05:30:00.000Z', note: 'enak "banget"' }),
    tx({ type: 'transfer', amount: 100000, accountId: 'Dompet', toAccountId: 'BCA', toAmount: 100000, name: 'Setor', date: '2025-03-11T05:30:00.000Z' }),
  ]
  it('re-imports what it exports and skips duplicates on a second pass', () => {
    const csv = toCsv([CSV_HEADER, ...transactionRows(txns, accounts, DEFAULT_CATEGORIES)])
    const r = parseTransactionsCsv(csv, accounts, DEFAULT_CATEGORIES, [])
    expect(r.errors).toEqual([]); expect(r.valid).toHaveLength(2)
    expect(r.valid[0]).toMatchObject({ name: 'Makan, siang', amount: 25000, type: 'expense', categoryId: 'exp-makan', note: 'enak "banget"' })
    expect(r.valid[1]).toMatchObject({ type: 'transfer', toAccountId: 'BCA' })
    expect(parseTransactionsCsv(csv, accounts, DEFAULT_CATEGORIES, r.valid).duplicates).toBe(2)
  })
  it('reports bad rows instead of importing them', () => {
    const r = parseTransactionsCsv('Tanggal,Nama,Akun,Nominal\n2025-03-01,Kopi,Tidak Ada,10000\nxx,Kopi,Dompet,10000\n2025-03-01,Kopi,Dompet,0', accounts, DEFAULT_CATEGORIES, [])
    expect(r.valid).toHaveLength(0); expect(r.errors).toHaveLength(3)
  })
})
