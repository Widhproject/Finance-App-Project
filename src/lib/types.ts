export type AccountKind = 'cash' | 'bank' | 'ewallet'
export type TxType = 'income' | 'expense' | 'transfer'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type CurrencyCode = 'IDR' | 'USD' | 'EUR' | 'SGD' | 'MYR' | 'JPY' | 'AUD'

/** All money amounts are integers in the minor unit of their currency (IDR: rupiah, USD: cents). */
export interface Account {
  id: string
  name: string
  kind: AccountKind
  currency: CurrencyCode
  openingBalance: number
  color: string
  createdAt: string
}

export interface ReceiptItem { name: string; qty: number; unitPrice: number; total: number }

export interface Transaction {
  id: string
  type: TxType
  name: string
  /** Amount in the currency of `accountId`. */
  amount: number
  accountId: string
  /** Transfers only. */
  toAccountId?: string
  /** Transfers only: amount credited, in the currency of `toAccountId`. */
  toAmount?: number
  categoryId?: string
  /** ISO timestamp. */
  date: string
  note: string
  hasAttachment?: boolean
  merchant?: string
  items?: ReceiptItem[]
  receiptKey?: string
  recurringId?: string
  recurringDate?: string
  createdAt: string
  updatedAt: string
}

export interface Category { id: string; name: string; type: 'income' | 'expense'; color: string; builtin?: boolean }
export interface Budget { id: string; categoryId: string; /** monthly limit, IDR */ amount: number }
export interface GoalEntry { id: string; date: string; /** + deposit, − withdrawal */ amount: number; note: string }
export interface Goal { id: string; name: string; target: number; deadline?: string; createdAt: string; entries: GoalEntry[] }

export interface Recurring {
  id: string
  name: string
  type: TxType
  amount: number
  accountId: string
  toAccountId?: string
  toAmount?: number
  categoryId?: string
  note: string
  frequency: Frequency
  /** YYYY-MM-DD */
  startDate: string
  endDate?: string
  active: boolean
  /** Occurrence dates (YYYY-MM-DD) already posted or skipped. Prevents duplicates. */
  processed: string[]
  createdAt: string
}

export interface Note { id: string; title: string; body: string; createdAt: string; updatedAt: string }

export interface Settings {
  pinHash?: string
  pinSalt?: string
  pinIterations?: number
  failedAttempts: number
  lockUntil: number
  autoLockMinutes: number
  theme: 'dark' | 'light'
  monthStartDay: number
  blockNegative: boolean
  hideBalance: boolean
  saveReceiptImage: boolean
  rates: Partial<Record<CurrencyCode, number>>
  reminder: { enabled: boolean; time: string }
  lastReminderDate?: string
}

export interface Snapshot {
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
  recurring: Recurring[]
  notes: Note[]
  settings: Settings
}
