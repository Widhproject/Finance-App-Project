import type { Category, Settings } from './types'

export const PALETTE = ['#5e6ad2', '#828fff', '#27a644', '#e5a63f', '#ef4444', '#38bdf8', '#c084fc', '#f472b6', '#14b8a6', '#8a8f98']

const c = (id: string, name: string, type: 'income' | 'expense', color: string): Category => ({ id, name, type, color, builtin: true })
export const DEFAULT_CATEGORIES: Category[] = [
  c('inc-gaji', 'Gaji', 'income', '#27a644'),
  c('inc-saku', 'Uang saku', 'income', '#14b8a6'),
  c('inc-freelance', 'Freelance', 'income', '#38bdf8'),
  c('inc-bisnis', 'Bisnis', 'income', '#5e6ad2'),
  c('inc-investasi', 'Investasi', 'income', '#828fff'),
  c('inc-hadiah', 'Hadiah', 'income', '#f472b6'),
  c('inc-lain', 'Lainnya', 'income', '#8a8f98'),
  c('exp-makan', 'Makanan dan minuman', 'expense', '#e5a63f'),
  c('exp-transport', 'Transportasi', 'expense', '#38bdf8'),
  c('exp-belanja', 'Belanja', 'expense', '#c084fc'),
  c('exp-hiburan', 'Hiburan', 'expense', '#f472b6'),
  c('exp-pendidikan', 'Pendidikan', 'expense', '#5e6ad2'),
  c('exp-kesehatan', 'Kesehatan', 'expense', '#ef4444'),
  c('exp-tagihan', 'Tagihan', 'expense', '#14b8a6'),
  c('exp-kos', 'Kos dan tempat tinggal', 'expense', '#828fff'),
  c('exp-gym', 'Gym dan fitness', 'expense', '#27a644'),
  c('exp-langganan', 'Langganan', 'expense', '#a78bfa'),
  c('exp-pribadi', 'Kebutuhan pribadi', 'expense', '#fb923c'),
  c('exp-lain', 'Lainnya', 'expense', '#8a8f98'),
]

export const DEFAULT_SETTINGS: Settings = {
  failedAttempts: 0,
  lockUntil: 0,
  autoLockMinutes: 5,
  theme: 'dark',
  monthStartDay: 1,
  blockNegative: false,
  hideBalance: false,
  saveReceiptImage: false,
  rates: {},
  reminder: { enabled: false, time: '20:00' },
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
