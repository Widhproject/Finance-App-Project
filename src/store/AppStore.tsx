import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Account, Budget, Category, Goal, Note, Recurring, Settings, Transaction } from '../lib/types'
import * as db from '../lib/db'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, uid } from '../lib/defaults'
import { balanceMap, budgetLevel, expenseByCategory, inRange, negativeAfter } from '../lib/calc'
import { formatMoney, pct } from '../lib/money'
import { periodFor, periodByKey, type Period } from '../lib/dates'
import { restoreBackup } from '../lib/backup'
import { fromDayKey } from '../lib/dates'

export type Result = { ok: true } | { ok: false; error: string }
export interface Toast { id: string; text: string; tone: 'info' | 'good' | 'warn' | 'bad' }

interface Ctx {
  ready: boolean
  locked: boolean
  lock: () => void
  unlock: () => void
  accounts: Account[]; transactions: Transaction[]; categories: Category[]; budgets: Budget[]; goals: Goal[]; recurring: Recurring[]; notes: Note[]
  settings: Settings
  balances: Map<string, number>
  period: Period
  periodOf: (key: string) => Period
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  saveTransaction: (t: Transaction, attachment?: Blob | null | 'keep') => Promise<Result>
  deleteTransaction: (id: string) => Promise<void>
  getAttachment: (id: string) => Promise<Blob | undefined>
  importTransactions: (ts: Transaction[], newCategories?: Category[]) => Promise<void>
  saveAccount: (a: Account) => Promise<void>
  deleteAccount: (id: string) => Promise<number>
  saveCategory: (c: Category) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  saveBudget: (b: Budget) => Promise<void>
  deleteBudget: (id: string) => Promise<void>
  saveGoal: (g: Goal) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  saveRecurring: (r: Recurring) => Promise<void>
  deleteRecurring: (id: string) => Promise<void>
  resolveRecurring: (r: Recurring, dates: string[], action: 'post' | 'skip') => Promise<number>
  saveNote: (n: Note) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  restore: (backup: unknown) => Promise<void>
  resetAll: () => Promise<void>
}
const C = createContext<Ctx>(null as never)
export const useApp = () => useContext(C)

const BUDGET_MSG = ['', 'sudah mencapai 80% dari anggaran', 'sudah mencapai 100% dari anggaran', 'melampaui anggaran']

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [locked, setLocked] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [recurring, setRecurring] = useState<Recurring[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [toasts, setToasts] = useState<Toast[]>([])
  const ref = useRef({ accounts, transactions, categories, budgets, settings })
  ref.current = { accounts, transactions, categories, budgets, settings }

  const load = useCallback(async () => {
    const snap = await db.loadSnapshot()
    let cats = (snap.categories ?? []) as Category[]
    if (cats.length === 0) { cats = DEFAULT_CATEGORIES; await db.putMany('categories', cats) }
    const s: Settings = { ...DEFAULT_SETTINGS }
    for (const r of snap.settingsRows) (s as any)[r.key] = r.value
    setAccounts((snap.accounts ?? []) as Account[]); setTransactions((snap.transactions ?? []) as Transaction[]); setCategories(cats)
    setBudgets((snap.budgets ?? []) as Budget[]); setGoals((snap.goals ?? []) as Goal[]); setRecurring((snap.recurring ?? []) as Recurring[]); setNotes((snap.notes ?? []) as Note[])
    setSettings(s)
    document.documentElement.dataset.theme = s.theme
  }, [])

  useEffect(() => { load().then(() => setReady(true)).catch(() => setReady(true)) }, [load])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = uid(); setToasts((t) => [...t.slice(-3), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const balances = useMemo(() => balanceMap(accounts, transactions), [accounts, transactions])
  const periodOf = useCallback((key: string) => periodByKey(key, settings.monthStartDay), [settings.monthStartDay])
  const period = useMemo(() => periodFor(new Date(), settings.monthStartDay), [settings.monthStartDay, transactions.length])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }))
    await db.putMany('settings', Object.entries(patch).map(([key, value]) => ({ key, value })))
    if (patch.theme) { document.documentElement.dataset.theme = patch.theme; try { localStorage.setItem('pfm.theme', patch.theme) } catch { /* private mode */ } }
  }, [])

  /** Warn when a budget crosses 80%, 100% or goes over, comparing spending before and after a change. */
  const budgetAlerts = useCallback((before: Transaction[], after: Transaction[], t: Transaction) => {
    if (t.type !== 'expense' || !t.categoryId) return
    const { accounts, budgets, categories, settings } = ref.current
    const b = budgets.find((x) => x.categoryId === t.categoryId); if (!b) return
    const p = periodFor(new Date(t.date), settings.monthStartDay)
    const spent = (txs: Transaction[]) => expenseByCategory(inRange(txs, p), accounts, settings.rates).get(b.categoryId) ?? 0
    const lb = budgetLevel(pct(spent(before), b.amount)), la = budgetLevel(pct(spent(after), b.amount))
    if (la > lb) {
      const name = categories.find((c) => c.id === b.categoryId)?.name ?? 'Kategori'
      const msg = `Anggaran ${name} ${BUDGET_MSG[la]} (${formatMoney(spent(after))} dari ${formatMoney(b.amount)}).`
      toast(msg, la === 1 ? 'warn' : 'bad')
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Peringatan anggaran', { body: msg })
    }
  }, [toast])

  const saveTransaction: Ctx['saveTransaction'] = useCallback(async (t, attachment = 'keep') => {
    const { accounts, transactions, settings } = ref.current
    const acc = accounts.find((a) => a.id === t.accountId)
    if (!acc) return { ok: false, error: 'Pilih akun terlebih dahulu.' }
    if (!Number.isSafeInteger(t.amount) || t.amount <= 0) return { ok: false, error: 'Nominal harus lebih dari 0.' }
    if (!t.name.trim()) return { ok: false, error: 'Nama transaksi wajib diisi.' }
    if (t.type === 'transfer') {
      const to = accounts.find((a) => a.id === t.toAccountId)
      if (!to) return { ok: false, error: 'Pilih akun tujuan.' }
      if (to.id === acc.id) return { ok: false, error: 'Akun asal dan tujuan tidak boleh sama.' }
      if (!Number.isSafeInteger(t.toAmount ?? t.amount) || (t.toAmount ?? t.amount) <= 0) return { ok: false, error: 'Nominal yang diterima akun tujuan tidak valid.' }
    }
    const exists = transactions.some((x) => x.id === t.id)
    const next = exists ? transactions.map((x) => (x.id === t.id ? t : x)) : [...transactions, t]
    if (settings.blockNegative) {
      const touched = [t.accountId, t.toAccountId].filter(Boolean) as string[]
      const before = balanceMap(accounts, transactions), after = balanceMap(accounts, next)
      const bad = negativeAfter(accounts, next, touched).find((a) => (after.get(a.id) ?? 0) < (before.get(a.id) ?? 0))
      if (bad) return { ok: false, error: `Saldo ${bad.name} tidak mencukupi. Pembatasan saldo negatif sedang aktif.` }
    }
    const ops: Parameters<typeof db.batch>[0] = [{ store: 'transactions', put: [t] }]
    if (attachment === null) ops.push({ store: 'attachments', del: [t.id] })
    else if (attachment !== 'keep') ops.push({ store: 'attachments', put: [{ id: t.id, blob: attachment }] })
    await db.batch(ops)
    setTransactions(next)
    budgetAlerts(transactions, next, t)
    return { ok: true }
  }, [budgetAlerts])

  const deleteTransaction = useCallback(async (id: string) => {
    await db.batch([{ store: 'transactions', del: [id] }, { store: 'attachments', del: [id] }])
    setTransactions((x) => x.filter((t) => t.id !== id))
  }, [])
  const getAttachment = useCallback(async (id: string) => (await db.get<{ id: string; blob: Blob }>('attachments', id))?.blob, [])

  const importTransactions: Ctx['importTransactions'] = useCallback(async (ts, newCats = []) => {
    await db.batch([{ store: 'transactions', put: ts }, { store: 'categories', put: newCats }])
    setTransactions((x) => [...x, ...ts]); setCategories((c) => [...c, ...newCats])
  }, [])

  const saveAccount = useCallback(async (a: Account) => { await db.put('accounts', a); setAccounts((x) => (x.some((y) => y.id === a.id) ? x.map((y) => (y.id === a.id ? a : y)) : [...x, a])) }, [])
  const deleteAccount = useCallback(async (id: string) => {
    const { transactions } = ref.current
    const gone = transactions.filter((t) => t.accountId === id || t.toAccountId === id).map((t) => t.id)
    await db.batch([{ store: 'accounts', del: [id] }, { store: 'transactions', del: gone }, { store: 'attachments', del: gone }])
    setAccounts((x) => x.filter((a) => a.id !== id)); setTransactions((x) => x.filter((t) => !gone.includes(t.id)))
    setRecurring((rs) => { const dead = rs.filter((r) => r.accountId === id || r.toAccountId === id).map((r) => r.id); if (dead.length) db.del('recurring', dead); return rs.filter((r) => !dead.includes(r.id)) })
    return gone.length
  }, [])

  const saveCategory = useCallback(async (c: Category) => { await db.put('categories', c); setCategories((x) => (x.some((y) => y.id === c.id) ? x.map((y) => (y.id === c.id ? c : y)) : [...x, c])) }, [])
  const deleteCategory = useCallback(async (id: string) => {
    const { categories, transactions, budgets } = ref.current
    const cat = categories.find((c) => c.id === id); if (!cat) return
    const fallback = cat.type === 'income' ? 'inc-lain' : 'exp-lain'
    const moved = transactions.filter((t) => t.categoryId === id).map((t) => ({ ...t, categoryId: fallback }))
    const dead = budgets.filter((b) => b.categoryId === id).map((b) => b.id)
    await db.batch([{ store: 'categories', del: [id] }, { store: 'transactions', put: moved }, { store: 'budgets', del: dead }])
    setCategories((x) => x.filter((c) => c.id !== id)); setBudgets((x) => x.filter((b) => !dead.includes(b.id)))
    setTransactions((x) => x.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback } : t)))
  }, [])

  const saveBudget = useCallback(async (b: Budget) => { await db.put('budgets', b); setBudgets((x) => (x.some((y) => y.id === b.id) ? x.map((y) => (y.id === b.id ? b : y)) : [...x, b])) }, [])
  const deleteBudget = useCallback(async (id: string) => { await db.del('budgets', [id]); setBudgets((x) => x.filter((b) => b.id !== id)) }, [])
  const saveGoal = useCallback(async (g: Goal) => { await db.put('goals', g); setGoals((x) => (x.some((y) => y.id === g.id) ? x.map((y) => (y.id === g.id ? g : y)) : [...x, g])) }, [])
  const deleteGoal = useCallback(async (id: string) => { await db.del('goals', [id]); setGoals((x) => x.filter((g) => g.id !== id)) }, [])
  const saveRecurring = useCallback(async (r: Recurring) => { await db.put('recurring', r); setRecurring((x) => (x.some((y) => y.id === r.id) ? x.map((y) => (y.id === r.id ? r : y)) : [...x, r])) }, [])
  const deleteRecurring = useCallback(async (id: string) => { await db.del('recurring', [id]); setRecurring((x) => x.filter((r) => r.id !== id)) }, [])
  const saveNote = useCallback(async (n: Note) => { await db.put('notes', n); setNotes((x) => (x.some((y) => y.id === n.id) ? x.map((y) => (y.id === n.id ? n : y)) : [n, ...x])) }, [])
  const deleteNote = useCallback(async (id: string) => { await db.del('notes', [id]); setNotes((x) => x.filter((n) => n.id !== id)) }, [])

  /**
   * Posting a recurring occurrence is always an explicit user action. The transaction id is derived from
   * (recurring id, date), so even a double tap can never create the same occurrence twice.
   */
  const resolveRecurring: Ctx['resolveRecurring'] = useCallback(async (r, dates, action) => {
    const { transactions } = ref.current
    const have = new Set(transactions.map((t) => t.id))
    const created: Transaction[] = []
    if (action === 'post') {
      for (const d of dates) {
        const id = `rec-${r.id}-${d}`; if (have.has(id)) continue
        const at = fromDayKey(d); at.setHours(9, 0, 0, 0)
        const now = new Date().toISOString()
        created.push({ id, type: r.type, name: r.name, amount: r.amount, accountId: r.accountId, toAccountId: r.toAccountId, toAmount: r.toAmount, categoryId: r.categoryId, date: at.toISOString(), note: r.note, recurringId: r.id, recurringDate: d, createdAt: now, updatedAt: now })
      }
    }
    const updated: Recurring = { ...r, processed: [...new Set([...r.processed, ...dates])] }
    await db.batch([{ store: 'transactions', put: created }, { store: 'recurring', put: [updated] }])
    setTransactions((x) => [...x, ...created]); setRecurring((x) => x.map((y) => (y.id === r.id ? updated : y)))
    return created.length
  }, [])

  const restore = useCallback(async (backup: unknown) => { await restoreBackup(backup); await load() }, [load])
  const resetAll = useCallback(async () => {
    const pin = ref.current.settings
    await db.replaceAll({ accounts: [], transactions: [], categories: DEFAULT_CATEGORIES, budgets: [], goals: [], recurring: [], notes: [], attachments: [] },
      Object.entries({ ...DEFAULT_SETTINGS, pinHash: pin.pinHash, pinSalt: pin.pinSalt, pinIterations: pin.pinIterations, theme: pin.theme }).filter(([, v]) => v !== undefined).map(([key, value]) => ({ key, value })))
    await load()
  }, [load])

  const value: Ctx = {
    ready, locked, lock: () => setLocked(true), unlock: () => setLocked(false),
    accounts, transactions, categories, budgets, goals, recurring, notes, settings, balances, period, periodOf,
    toasts, toast, dismissToast, updateSettings, saveTransaction, deleteTransaction, getAttachment, importTransactions,
    saveAccount, deleteAccount, saveCategory, deleteCategory, saveBudget, deleteBudget, saveGoal, deleteGoal,
    saveRecurring, deleteRecurring, resolveRecurring, saveNote, deleteNote, restore, resetAll,
  }
  return <C.Provider value={value}>{children}</C.Provider>
}
