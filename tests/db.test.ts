import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import * as db from '../src/lib/db'
import { createBackup, restoreBackup, validateBackup } from '../src/lib/backup'
import { DEFAULT_CATEGORIES } from '../src/lib/defaults'

describe('backup & restore', () => {
  it('restores every table, keeps the current PIN, and is atomic on bad input', async () => {
    const acc = { id: 'a1', name: 'BCA', kind: 'bank', currency: 'IDR', openingBalance: 1000, color: '#fff', createdAt: '2025-01-01T00:00:00Z' }
    const t = { id: 't1', type: 'expense', name: 'Kopi', amount: 5000, accountId: 'a1', categoryId: 'exp-makan', date: '2025-01-02T00:00:00Z', note: '', createdAt: '', updatedAt: '' }
    await db.putMany('accounts', [acc]); await db.putMany('transactions', [t]); await db.putMany('categories', DEFAULT_CATEGORIES)
    await db.putMany('budgets', [{ id: 'b1', categoryId: 'exp-makan', amount: 100000 }])
    await db.putMany('goals', [{ id: 'g1', name: 'Laptop', target: 1e7, createdAt: '', entries: [] }])
    await db.putMany('recurring', [{ id: 'r1', name: 'Kos', type: 'expense', amount: 1, accountId: 'a1', note: '', frequency: 'monthly', startDate: '2025-01-01', active: true, processed: [], createdAt: '' }])
    await db.putMany('notes', [{ id: 'n1', title: 'x', body: 'y', createdAt: '', updatedAt: '' }])
    await db.putMany('settings', [{ key: 'pinHash', value: 'OLDPIN' }, { key: 'monthStartDay', value: 25 }])

    const backup = await createBackup()
    expect(JSON.stringify(backup)).not.toContain('OLDPIN')          // PIN never leaves the device
    expect(validateBackup(backup)).toBeNull()

    await db.replaceAll({ accounts: [], transactions: [], categories: [], budgets: [], goals: [], recurring: [], notes: [], attachments: [] }, [{ key: 'pinHash', value: 'NEWPIN' }])
    expect(await db.getAll('transactions')).toHaveLength(0)

    await restoreBackup(JSON.parse(JSON.stringify(backup)))
    for (const s of ['accounts', 'transactions', 'budgets', 'goals', 'recurring', 'notes'] as const) expect(await db.getAll(s)).toHaveLength(1)
    expect((await db.getAll('categories')).length).toBe(DEFAULT_CATEGORIES.length)
    const settings = Object.fromEntries((await db.getAll<{ key: string; value: unknown }>('settings')).map((r) => [r.key, r.value]))
    expect(settings.monthStartDay).toBe(25); expect(settings.pinHash).toBe('NEWPIN')

    await expect(restoreBackup({ app: 'x' })).rejects.toThrow()
    await expect(restoreBackup({ ...backup, data: { ...backup.data, transactions: [{ ...t, accountId: 'ghost' }] } })).rejects.toThrow()
    expect(await db.getAll('transactions')).toHaveLength(1)          // untouched after failed restores
  })
})
