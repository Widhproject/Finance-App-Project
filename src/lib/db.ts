import type { Snapshot } from './types'

const DB_NAME = 'pfm-db'
const VERSION = 1
export const STORES = ['accounts', 'transactions', 'categories', 'budgets', 'goals', 'recurring', 'notes', 'attachments', 'settings'] as const
export type StoreName = (typeof STORES)[number]

let dbp: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'settings' ? 'key' : 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

const wrap = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb()
  return wrap(db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>)
}
export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb()
  return wrap(db.transaction(store).objectStore(store).get(key) as IDBRequest<T | undefined>)
}
export async function putMany(store: StoreName, values: unknown[]) {
  const db = await openDb(); const tx = db.transaction(store, 'readwrite')
  values.forEach((v) => tx.objectStore(store).put(v)); await done(tx)
}
export const put = (store: StoreName, value: unknown) => putMany(store, [value])
export async function del(store: StoreName, ids: string[]) {
  const db = await openDb(); const tx = db.transaction(store, 'readwrite')
  ids.forEach((id) => tx.objectStore(store).delete(id)); await done(tx)
}

/** Several writes across stores in one atomic IndexedDB transaction. */
export async function batch(ops: { store: StoreName; put?: unknown[]; del?: string[] }[]) {
  const db = await openDb()
  const tx = db.transaction([...new Set(ops.map((o) => o.store))], 'readwrite')
  for (const o of ops) { o.put?.forEach((v) => tx.objectStore(o.store).put(v)); o.del?.forEach((k) => tx.objectStore(o.store).delete(k)) }
  await done(tx)
}

export async function loadSnapshot(): Promise<Partial<Snapshot> & { settingsRows: { key: string; value: unknown }[] }> {
  const [accounts, transactions, categories, budgets, goals, recurring, notes, settingsRows] = await Promise.all([
    getAll('accounts'), getAll('transactions'), getAll('categories'), getAll('budgets'), getAll('goals'), getAll('recurring'), getAll('notes'),
    getAll<{ key: string; value: unknown }>('settings'),
  ])
  return { accounts, transactions, categories, budgets, goals, recurring, notes, settingsRows } as never
}

/** Replace the entire database in a single atomic transaction (used by restore). `keepSettingKeys` survive. */
export async function replaceAll(data: Record<Exclude<StoreName, 'settings'>, unknown[]>, settingsRows: { key: string; value: unknown }[]) {
  const db = await openDb()
  const tx = db.transaction([...STORES], 'readwrite')
  for (const s of STORES) tx.objectStore(s).clear()
  for (const s of STORES) if (s !== 'settings') (data[s] ?? []).forEach((v) => tx.objectStore(s).put(v))
  settingsRows.forEach((r) => tx.objectStore('settings').put(r))
  await done(tx)
}
