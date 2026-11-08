import { getAll, replaceAll, loadSnapshot } from './db'
import type { Snapshot } from './types'

export const BACKUP_VERSION = 1
const SECRET_KEYS = ['pinHash', 'pinSalt', 'pinIterations', 'failedAttempts', 'lockUntil']

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })
const dataUrlToBlob = async (u: string) => (await fetch(u)).blob()

/** Full backup: every table plus receipt photos. The PIN hash is deliberately left out of the file. */
export async function createBackup() {
  const snap = await loadSnapshot()
  const attachments = await getAll<{ id: string; blob: Blob }>('attachments')
  const settings: Record<string, unknown> = {}
  for (const r of snap.settingsRows) if (!SECRET_KEYS.includes(r.key)) settings[r.key] = r.value
  return {
    app: 'personal-finance-manager', version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    data: {
      accounts: snap.accounts, transactions: snap.transactions, categories: snap.categories, budgets: snap.budgets,
      goals: snap.goals, recurring: snap.recurring, notes: snap.notes, settings,
      attachments: await Promise.all(attachments.map(async (a) => ({ id: a.id, dataUrl: await blobToDataUrl(a.blob) }))),
    },
  }
}

export function validateBackup(x: any): string | null {
  if (!x || x.app !== 'personal-finance-manager') return 'Bukan file backup aplikasi ini.'
  if (typeof x.version !== 'number' || x.version > BACKUP_VERSION) return 'Versi backup tidak dikenali.'
  const d = x.data
  if (!d) return 'Isi backup kosong.'
  for (const k of ['accounts', 'transactions', 'categories', 'budgets', 'goals', 'recurring', 'notes']) if (!Array.isArray(d[k])) return `Bagian "${k}" pada backup rusak.`
  const ids = new Set(d.accounts.map((a: any) => a.id))
  for (const t of d.transactions) if (!t.id || !ids.has(t.accountId) || !Number.isSafeInteger(t.amount)) return 'Ada transaksi yang tidak valid atau akunnya hilang.'
  return null
}

/** Atomically replaces all data. Current PIN and lockout state are preserved. */
export async function restoreBackup(x: any) {
  const err = validateBackup(x)
  if (err) throw new Error(err)
  const d = x.data
  const current = await getAll<{ key: string; value: unknown }>('settings')
  const keep = current.filter((r) => SECRET_KEYS.includes(r.key))
  const rows = Object.entries(d.settings ?? {}).filter(([k]) => !SECRET_KEYS.includes(k)).map(([key, value]) => ({ key, value }))
  const attachments = await Promise.all((d.attachments ?? []).map(async (a: any) => ({ id: a.id, blob: await dataUrlToBlob(a.dataUrl) })))
  await replaceAll({ accounts: d.accounts, transactions: d.transactions, categories: d.categories, budgets: d.budgets, goals: d.goals, recurring: d.recurring, notes: d.notes, attachments }, [...rows, ...keep])
}

export type { Snapshot }
