import { useMemo, useState } from 'react'
import { Check, Pencil, Plus, Repeat, SkipForward, Trash2 } from 'lucide-react'
import type { Frequency, Recurring, TxType } from '../lib/types'
import { useApp } from '../store/AppStore'
import { ConfirmDialog, EmptyState, Field, Modal, Money, MoneyInput, PageHeader, Segmented } from '../components/ui'
import { FREQ_LABEL, dueOccurrences, nextOccurrence } from '../lib/recurring'
import { formatDate, fromDayKey, todayKey } from '../lib/dates'
import { minorToInput, parseMinor } from '../lib/money'
import { uid } from '../lib/defaults'

export default function RecurringPage() {
  const { recurring, accounts, categories, saveRecurring, deleteRecurring, resolveRecurring, toast } = useApp()
  const [edit, setEdit] = useState<Recurring | 'new' | null>(null)
  const [del, setDel] = useState<Recurring | null>(null)
  const today = todayKey()
  const due = useMemo(() => recurring.map((r) => ({ r, dates: dueOccurrences(r, today) })).filter((x) => x.dates.length), [recurring, today])

  return (
    <>
      <PageHeader title="Transaksi Berulang" subtitle="Tagihan dan pemasukan rutin. Tidak ada yang dicatat otomatis tanpa konfirmasi Anda." actions={<button className="btn-primary" onClick={() => setEdit('new')} disabled={accounts.length === 0}><Plus size={16} />Tambah</button>} />
      {due.length > 0 && (
        <section className="card p-4 mb-6 border-primary/50">
          <h2 className="h2 mb-3">Jatuh tempo — perlu konfirmasi</h2>
          <ul className="divide-y divide-hair">
            {due.map(({ r, dates }) => (
              <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{r.name} <span className="text-ink-subtle font-normal">· <Money minor={r.amount} currency={accounts.find((a) => a.id === r.accountId)?.currency} /></span></p>
                  <p className="text-caption text-ink-subtle">{dates.length === 1 ? formatDate(fromDayKey(dates[0])) : `${dates.length} tanggal: ${formatDate(fromDayKey(dates[0]), false)} – ${formatDate(fromDayKey(dates[dates.length - 1]), false)}`}</p></div>
                <div className="flex gap-2">
                  <button className="btn-primary h-9" onClick={async () => { const n = await resolveRecurring(r, dates, 'post'); toast(`${n} transaksi dicatat.`, 'good') }}><Check size={15} />Catat{dates.length > 1 ? ` ${dates.length}` : ''}</button>
                  <button className="btn-secondary h-9" onClick={async () => { await resolveRecurring(r, dates, 'skip'); toast('Dilewati.', 'info') }}><SkipForward size={15} />Lewati</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recurring.length === 0 ? (
        <div className="panel"><EmptyState icon={<Repeat size={20} />} title="Belum ada transaksi berulang" text="Contoh: uang saku bulanan, biaya kos, tagihan internet, atau langganan Spotify." action={accounts.length ? <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} />Tambah</button> : undefined} /></div>
      ) : (
        <div className="card divide-y divide-hair">
          {recurring.map((r) => { const next = nextOccurrence(r, today); const acc = accounts.find((a) => a.id === r.accountId)
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{r.name}</p>
                  <p className="text-caption text-ink-subtle truncate">{FREQ_LABEL[r.frequency]} · {acc?.name ?? '?'} · {!r.active ? 'Dijeda' : next ? `Berikutnya ${formatDate(fromDayKey(next))}` : 'Selesai'}</p></div>
                <span className={r.type === 'income' ? 'text-income num font-medium' : 'num font-medium'}><Money minor={r.amount} currency={acc?.currency} /></span>
                <button className="btn-icon" aria-label="Edit" onClick={() => setEdit(r)}><Pencil size={15} /></button>
                <button className="btn-icon" aria-label="Hapus" onClick={() => setDel(r)}><Trash2 size={15} /></button>
              </div>
            ) })}
        </div>
      )}
      <RecurringForm value={edit} onClose={() => setEdit(null)} onSave={async (r) => { await saveRecurring(r); toast('Tersimpan.', 'good'); setEdit(null) }} accounts={accounts} categories={categories} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Hapus transaksi berulang?" message="Jadwal dihapus. Transaksi yang sudah dicatat sebelumnya tetap ada." onConfirm={async () => { if (del) await deleteRecurring(del.id) }} />
    </>
  )
}

function RecurringForm({ value, onClose, onSave, accounts, categories }: { value: Recurring | 'new' | null; onClose: () => void; onSave: (r: Recurring) => Promise<void>; accounts: ReturnType<typeof useApp>['accounts']; categories: ReturnType<typeof useApp>['categories'] }) {
  const ex = value && value !== 'new' ? value : null
  const [key, setKey] = useState<unknown>(null)
  const [type, setType] = useState<TxType>('expense'), [name, setName] = useState(''), [amount, setAmount] = useState(''), [accountId, setAccountId] = useState('')
  const [toId, setToId] = useState(''), [catId, setCatId] = useState(''), [freq, setFreq] = useState<Frequency>('monthly'), [start, setStart] = useState(todayKey()), [end, setEnd] = useState('')
  const [active, setActive] = useState(true), [err, setErr] = useState<Record<string, string>>({})
  if (value !== key) {
    setKey(value); setErr({})
    setType(ex?.type ?? 'expense'); setName(ex?.name ?? ''); setAmount(ex ? minorToInput(ex.amount, accounts.find((a) => a.id === ex.accountId)?.currency) : ''); setAccountId(ex?.accountId ?? accounts[0]?.id ?? '')
    setToId(ex?.toAccountId ?? ''); setCatId(ex?.categoryId ?? ''); setFreq(ex?.frequency ?? 'monthly'); setStart(ex?.startDate ?? todayKey()); setEnd(ex?.endDate ?? ''); setActive(ex?.active ?? true)
  }
  const acc = accounts.find((a) => a.id === accountId)
  function submit() {
    const e: Record<string, string> = {}, amt = acc ? parseMinor(amount, acc.currency) : null
    if (!name.trim()) e.name = 'Nama wajib diisi.'
    if (!amt || amt <= 0) e.amount = 'Masukkan nominal lebih dari 0.'
    if (type === 'transfer' && (!toId || toId === accountId)) e.to = 'Pilih akun tujuan yang berbeda.'
    if (type === 'transfer' && toId && accounts.find((a) => a.id === toId)?.currency !== acc?.currency) e.to = 'Transfer berulang hanya untuk akun dengan mata uang sama.'
    if (!start) e.start = 'Tanggal mulai wajib diisi.'
    if (end && end < start) e.end = 'Tanggal berakhir harus setelah tanggal mulai.'
    setErr(e); if (Object.keys(e).length) return
    onSave({ id: ex?.id ?? uid(), name: name.trim(), type, amount: amt!, accountId, toAccountId: type === 'transfer' ? toId : undefined, toAmount: type === 'transfer' ? amt! : undefined,
      categoryId: type === 'transfer' ? undefined : catId || (type === 'income' ? 'inc-lain' : 'exp-lain'), note: ex?.note ?? '', frequency: freq, startDate: start, endDate: end || undefined, active,
      // Changing the start date or frequency re-bases the schedule, so old processed markers no longer apply.
      processed: ex && ex.startDate === start && ex.frequency === freq ? ex.processed : [], createdAt: ex?.createdAt ?? new Date().toISOString() })
  }
  return (
    <Modal open={!!value} onClose={onClose} title={ex ? 'Edit transaksi berulang' : 'Transaksi berulang baru'} footer={<><button className="btn-secondary" onClick={onClose}>Batal</button><button className="btn-primary" onClick={submit}>Simpan</button></>}>
      <div className="space-y-4">
        <Segmented value={type} onChange={setType} options={[{ value: 'expense', label: 'Pengeluaran' }, { value: 'income', label: 'Pemasukan' }, { value: 'transfer', label: 'Transfer' }]} />
        <Field label="Nama" error={err.name}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Biaya kos" maxLength={60} /></Field>
        <Field label="Nominal" error={err.amount}><MoneyInput value={amount} onChange={setAmount} currency={acc?.currency ?? 'IDR'} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={type === 'transfer' ? 'Dari akun' : 'Akun'}><select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          {type === 'transfer' ? <Field label="Ke akun" error={err.to}><select className="input" value={toId} onChange={(e) => setToId(e.target.value)}><option value="">Pilih</option>{accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            : <Field label="Kategori"><select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}><option value="">Lainnya</option>{categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense') && c.name !== 'Lainnya').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        </div>
        <Field label="Periode"><Segmented value={freq} onChange={setFreq} options={(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => ({ value: f, label: FREQ_LABEL[f] }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal mulai" error={err.start}><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Berakhir (opsional)" error={err.end}><input type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[rgb(var(--primary))]" checked={active} onChange={(e) => setActive(e.target.checked)} />Aktif</label>
      </div>
    </Modal>
  )
}
