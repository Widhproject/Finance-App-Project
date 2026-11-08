import { useState } from 'react'
import { Minus, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import type { Goal } from '../lib/types'
import { useApp } from '../store/AppStore'
import { ConfirmDialog, EmptyState, Field, Modal, Money, MoneyInput, PageHeader, Progress, Segmented, cx } from '../components/ui'
import { formatMoney, minorToInput, parseMinor } from '../lib/money'
import { formatDate, dayKey, todayKey } from '../lib/dates'
import { uid } from '../lib/defaults'

const saved = (g: Goal) => g.entries.reduce((s, e) => s + e.amount, 0)

/** Average monthly saving since the first deposit (min. 1 month) → months & date to reach the target. */
function estimate(g: Goal) {
  const got = saved(g), left = g.target - got
  if (left <= 0) return { done: true as const }
  const first = g.entries.length ? Math.min(...g.entries.map((e) => +new Date(e.date))) : +new Date(g.createdAt)
  const months = Math.max(1, (Date.now() - first) / (30.44 * 864e5))
  const avg = got / months
  if (avg <= 0) return { done: false as const, avg: 0 }
  const need = left / avg
  return { done: false as const, avg, months: need, date: new Date(Date.now() + need * 30.44 * 864e5) }
}

export default function Goals() {
  const { goals, saveGoal, deleteGoal, toast } = useApp()
  const [edit, setEdit] = useState<Goal | 'new' | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [del, setDel] = useState<Goal | null>(null)
  const [name, setName] = useState(''), [target, setTarget] = useState(''), [deadline, setDeadline] = useState(''), [err, setErr] = useState<Record<string, string>>({})
  const g = goals.find((x) => x.id === detail) ?? null

  function open(x: Goal | 'new') { setEdit(x); setErr({}); if (x === 'new') { setName(''); setTarget(''); setDeadline('') } else { setName(x.name); setTarget(minorToInput(x.target)); setDeadline(x.deadline ?? '') } }
  async function save() {
    const e: Record<string, string> = {}, t = parseMinor(target)
    if (!name.trim()) e.name = 'Nama target wajib diisi.'
    if (!t || t <= 0) e.target = 'Masukkan nominal target lebih dari 0.'
    setErr(e); if (Object.keys(e).length) return
    const base = edit !== 'new' && edit ? edit : { id: uid(), createdAt: new Date().toISOString(), entries: [] }
    await saveGoal({ ...base, name: name.trim(), target: t!, deadline: deadline || undefined })
    toast('Target disimpan.', 'good'); setEdit(null)
  }

  return (
    <>
      <PageHeader title="Target Tabungan" subtitle="Kumpulkan dana untuk tujuan tertentu dan pantau progresnya." actions={<button className="btn-primary" onClick={() => open('new')}><Plus size={16} />Tambah target</button>} />
      {goals.length === 0 ? (
        <div className="panel"><EmptyState icon={<Target size={20} />} title="Belum ada target" text="Contoh: laptop Rp10.000.000, dana darurat Rp5.000.000, atau liburan." action={<button className="btn-primary" onClick={() => open('new')}><Plus size={16} />Tambah target</button>} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {goals.map((x) => {
            const got = saved(x), p = (got / x.target) * 100, est = estimate(x)
            return (
              <div key={x.id} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start gap-2"><h3 className="font-medium flex-1 text-[16px]">{x.name}</h3>
                  <button className="btn-icon -mt-1" aria-label="Edit target" onClick={() => open(x)}><Pencil size={15} /></button>
                  <button className="btn-icon -mt-1 -mr-2" aria-label="Hapus target" onClick={() => setDel(x)}><Trash2 size={15} /></button></div>
                <div><p className="text-[22px] font-semibold" style={{ letterSpacing: '-0.5px' }}><Money minor={got} /></p><p className="text-ink-subtle">dari <Money minor={x.target} /> · {Math.min(100, Math.round(p))}%</p></div>
                <Progress percent={p} />
                <p className="text-[13px] text-ink-muted min-h-[40px]">
                  {'done' in est && est.done ? 'Target tercapai.' : est.avg === 0 ? 'Tambahkan dana untuk melihat estimasi pencapaian.' : `Dengan rata-rata ${formatMoney(Math.round(est.avg!))}/bulan, target tercapai sekitar ${formatDate(est.date!)} (${Math.ceil(est.months!)} bulan lagi).`}
                  {x.deadline && !('done' in est && est.done) && <span className="block text-ink-subtle mt-0.5">Deadline {formatDate(x.deadline + 'T12:00:00')}{(() => { const mLeft = Math.max(0, (+new Date(x.deadline + 'T23:59:59') - Date.now()) / (30.44 * 864e5)); const need = x.target - got; return mLeft > 0 ? ` · perlu ${formatMoney(Math.ceil(need / Math.max(mLeft, 1)))}/bulan` : x.deadline < todayKey() ? ' · sudah lewat' : '' })()}</span>}
                </p>
                <button className="btn-secondary mt-auto" onClick={() => setDetail(x.id)}>Kelola dana & riwayat</button>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Tambah target' : 'Edit target'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Batal</button><button className="btn-primary" onClick={save}>Simpan target</button></>}>
        <div className="space-y-4">
          <Field label="Nama target" error={err.name}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Laptop baru" maxLength={60} /></Field>
          <Field label="Nominal target" error={err.target}><MoneyInput value={target} onChange={setTarget} currency="IDR" /></Field>
          <Field label="Deadline (opsional)"><input type="date" className="input" value={deadline} min={dayKey(new Date())} onChange={(e) => setDeadline(e.target.value)} /></Field>
        </div>
      </Modal>
      {g && <GoalDetail goal={g} onClose={() => setDetail(null)} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={`Hapus target ${del?.name}?`} message="Target beserta riwayat penambahan dan penarikan dananya akan dihapus." onConfirm={async () => { if (del) await deleteGoal(del.id) }} />
    </>
  )
}

function GoalDetail({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { saveGoal, toast } = useApp()
  const [mode, setMode] = useState<'in' | 'out'>('in'), [amount, setAmount] = useState(''), [note, setNote] = useState(''), [err, setErr] = useState('')
  const got = saved(goal)
  async function add() {
    const v = parseMinor(amount)
    if (!v || v <= 0) return setErr('Masukkan nominal lebih dari 0.')
    if (mode === 'out' && v > got) return setErr('Penarikan melebihi dana yang terkumpul.')
    await saveGoal({ ...goal, entries: [{ id: uid(), date: new Date().toISOString(), amount: mode === 'in' ? v : -v, note: note.trim() }, ...goal.entries] })
    setAmount(''); setNote(''); setErr(''); toast(mode === 'in' ? 'Dana ditambahkan.' : 'Dana ditarik.', 'good')
  }
  return (
    <Modal open onClose={onClose} title={goal.name} wide>
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="card bg-canvas p-3"><p className="text-caption text-ink-subtle">Terkumpul</p><p className="text-[20px] font-semibold"><Money minor={got} /></p><p className="text-caption text-ink-subtle">dari <Money minor={goal.target} /></p></div>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'in', label: 'Tambah dana' }, { value: 'out', label: 'Tarik dana' }]} />
          {err && <p className="text-expense text-[13px]" role="alert">{err}</p>}
          <Field label="Nominal"><MoneyInput value={amount} onChange={setAmount} currency="IDR" /></Field>
          <Field label="Catatan (opsional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} /></Field>
          <button className="btn-primary w-full" onClick={add}>{mode === 'in' ? <Plus size={16} /> : <Minus size={16} />}{mode === 'in' ? 'Tambah dana' : 'Tarik dana'}</button>
          <p className="text-caption text-ink-faint">Dana target dicatat terpisah dan tidak mengubah saldo akun Anda.</p>
        </div>
        <div>
          <h3 className="h2 mb-2">Riwayat</h3>
          {goal.entries.length === 0 ? <p className="text-ink-subtle py-6">Belum ada riwayat.</p> : (
            <ul className="card divide-y divide-hair max-h-[40dvh] overflow-y-auto">
              {goal.entries.map((e) => (
                <li key={e.id} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="flex-1 min-w-0"><span className="block truncate">{e.note || (e.amount > 0 ? 'Penambahan dana' : 'Penarikan dana')}</span><span className="text-caption text-ink-subtle">{formatDate(e.date)}</span></span>
                  <span className={cx('num font-medium', e.amount > 0 && 'text-income')}>{formatMoney(e.amount, 'IDR', { sign: true })}</span>
                  <button className="btn-icon" aria-label="Hapus riwayat" onClick={() => saveGoal({ ...goal, entries: goal.entries.filter((x) => x.id !== e.id) })}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
