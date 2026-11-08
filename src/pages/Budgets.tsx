import { useMemo, useState } from 'react'
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import type { Budget } from '../lib/types'
import { useApp } from '../store/AppStore'
import { ConfirmDialog, EmptyState, Field, Modal, Money, MoneyInput, PageHeader, Progress, cx } from '../components/ui'
import PeriodPicker from '../components/PeriodPicker'
import { budgetStatuses, expenseByCategory, inRange } from '../lib/calc'
import { minorToInput, parseMinor } from '../lib/money'
import { uid } from '../lib/defaults'

export default function Budgets() {
  const { budgets, categories, transactions, accounts, settings, period, periodOf, saveBudget, deleteBudget, toast } = useApp()
  const [key, setKey] = useState(period.key)
  const [edit, setEdit] = useState<Budget | 'new' | null>(null)
  const [del, setDel] = useState<Budget | null>(null)
  const [catId, setCatId] = useState(''), [amount, setAmount] = useState(''), [err, setErr] = useState('')

  const statuses = useMemo(() => {
    const spent = expenseByCategory(inRange(transactions, periodOf(key)), accounts, settings.rates)
    return budgetStatuses(budgets, categories, spent).sort((a, b) => b.percent - a.percent)
  }, [budgets, categories, transactions, accounts, settings.rates, key, periodOf])
  const totalBudget = statuses.reduce((s, x) => s + x.budget.amount, 0), totalSpent = statuses.reduce((s, x) => s + x.spent, 0)
  const free = categories.filter((c) => c.type === 'expense' && (!budgets.some((b) => b.categoryId === c.id) || (edit !== 'new' && edit?.categoryId === c.id)))

  function open(b: Budget | 'new') { setEdit(b); setErr(''); if (b === 'new') { setCatId(''); setAmount('') } else { setCatId(b.categoryId); setAmount(minorToInput(b.amount)) } }
  async function save() {
    const v = parseMinor(amount)
    if (!catId) return setErr('Pilih kategori.')
    if (!v || v <= 0) return setErr('Masukkan batas anggaran lebih dari 0.')
    await saveBudget({ id: edit !== 'new' && edit ? edit.id : uid(), categoryId: catId, amount: v })
    toast('Anggaran disimpan.', 'good'); setEdit(null)
  }
  const levelText = ['Aman', 'Mendekati batas', 'Batas tercapai', 'Terlampaui']

  return (
    <>
      <PageHeader title="Anggaran" subtitle="Batas pengeluaran bulanan per kategori. Berlaku untuk setiap periode."
        actions={<><PeriodPicker value={key} onChange={setKey} /><button className="btn-primary" onClick={() => open('new')}><Plus size={16} />Atur anggaran</button></>} />
      {statuses.length === 0 ? (
        <div className="panel"><EmptyState icon={<PiggyBank size={20} />} title="Belum ada anggaran" text="Tetapkan batas bulanan, misalnya Makanan Rp1.000.000. Anda akan diberi tahu saat pengeluaran mencapai 80% dan 100%." action={<button className="btn-primary" onClick={() => open('new')}><Plus size={16} />Atur anggaran</button>} /></div>
      ) : (
        <>
          <div className="card p-5 mb-5">
            <div className="flex justify-between items-baseline mb-3"><span className="text-ink-subtle">Total terpakai</span><span className="num"><Money minor={totalSpent} /> <span className="text-ink-subtle">dari <Money minor={totalBudget} /></span></span></div>
            <Progress percent={totalBudget ? (totalSpent / totalBudget) * 100 : 0} level={totalSpent > totalBudget ? 3 : totalSpent / totalBudget >= 0.8 ? 1 : 0} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {statuses.map((s) => (
              <div key={s.budget.id} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.category?.color }} />
                  <h3 className="font-medium flex-1 truncate">{s.category?.name ?? 'Kategori dihapus'}</h3>
                  <span className={cx('badge', s.level === 3 && 'text-expense', s.level === 2 && 'text-expense', s.level === 1 && 'text-warn', s.level === 0 && 'text-income')}>{levelText[s.level]}</span>
                  <button className="btn-icon" aria-label="Edit anggaran" onClick={() => open(s.budget)}><Pencil size={15} /></button>
                  <button className="btn-icon" aria-label="Hapus anggaran" onClick={() => setDel(s.budget)}><Trash2 size={15} /></button>
                </div>
                <Progress percent={s.percent} level={s.level} />
                <div className="grid grid-cols-3 gap-2 mt-3 text-[13px]">
                  <div><p className="text-ink-subtle text-caption">Anggaran</p><Money minor={s.budget.amount} /></div>
                  <div><p className="text-ink-subtle text-caption">Terpakai ({Math.round(s.percent)}%)</p><Money minor={s.spent} /></div>
                  <div><p className="text-ink-subtle text-caption">{s.remaining < 0 ? 'Lebih' : 'Sisa'}</p><span className={cx(s.remaining < 0 && 'text-expense')}><Money minor={Math.abs(s.remaining)} /></span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Atur anggaran' : 'Edit anggaran'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Batal</button><button className="btn-primary" onClick={save}>Simpan anggaran</button></>}>
        <div className="space-y-4">
          {err && <p className="text-expense text-[13px]" role="alert">{err}</p>}
          <Field label="Kategori pengeluaran"><select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}><option value="">Pilih kategori</option>{free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Batas per bulan"><MoneyInput value={amount} onChange={setAmount} currency="IDR" /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Hapus anggaran?" message="Batas anggaran untuk kategori ini dihapus. Transaksi tidak terpengaruh." onConfirm={async () => { if (del) await deleteBudget(del.id) }} />
    </>
  )
}
