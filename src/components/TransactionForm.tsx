import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import type { Category, Transaction, TxType } from '../lib/types'
import { useApp } from '../store/AppStore'
import { Field, Modal, MoneyInput, Segmented, cx } from './ui'
import { CURRENCIES, minorToInput, parseMinor } from '../lib/money'
import { fromLocalInput, nowLocalInput, toLocalInput } from '../lib/dates'
import { PALETTE, uid } from '../lib/defaults'
import { resizeImage } from '../lib/image'

export type TxPreset = Partial<Transaction>

export default function TransactionForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: TxPreset }) {
  const { accounts, categories, transactions, saveTransaction, saveCategory, getAttachment, toast, settings } = useApp()
  const existing = initial?.id ? transactions.find((t) => t.id === initial.id) : undefined
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(nowLocalInput())
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [note, setNote] = useState('')
  const [newCat, setNewCat] = useState<string | null>(null)
  const [photo, setPhoto] = useState<Blob | null | 'keep'>('keep')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Reset the form whenever it opens.
  useEffect(() => {
    if (!open) return
    const i = initial ?? {}
    const acc = accounts.find((a) => a.id === (i.accountId ?? accounts[0]?.id))
    setType(i.type ?? 'expense'); setName(i.name ?? ''); setNote(i.note ?? '')
    setAmount(i.amount ? minorToInput(i.amount, acc?.currency) : ''); setCategoryId(i.categoryId ?? '')
    setDate(i.date ? toLocalInput(i.date) : nowLocalInput()); setAccountId(acc?.id ?? ''); setToAccountId(i.toAccountId ?? '')
    setToAmount(i.toAmount ? minorToInput(i.toAmount, accounts.find((a) => a.id === i.toAccountId)?.currency) : '')
    setNewCat(null); setPhoto('keep'); setErrors({}); setSaving(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let url: string | null = null, dead = false
    if (photo instanceof Blob) { url = URL.createObjectURL(photo); setPhotoUrl(url) }
    else if (photo === 'keep' && existing?.hasAttachment) getAttachment(existing.id).then((b) => { if (b && !dead) { url = URL.createObjectURL(b); setPhotoUrl(url) } })
    else setPhotoUrl(null)
    return () => { dead = true; if (url) URL.revokeObjectURL(url) }
  }, [photo, existing?.id, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const acc = accounts.find((a) => a.id === accountId), toAcc = accounts.find((a) => a.id === toAccountId)
  const cats = useMemo(() => categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense')), [categories, type])
  const crossCurrency = type === 'transfer' && acc && toAcc && acc.currency !== toAcc.currency

  async function submit() {
    const e: Record<string, string> = {}
    if (!acc) e.account = 'Pilih akun. Tambahkan akun lebih dulu di menu Akun Saya.'
    const amt = acc ? parseMinor(amount, acc.currency) : null
    if (!amt || amt <= 0) e.amount = 'Masukkan nominal lebih dari 0.'
    if (type !== 'transfer' && !name.trim()) e.name = 'Nama transaksi wajib diisi.'
    if (!date || isNaN(new Date(date).getTime())) e.date = 'Tanggal tidak valid.'
    let toAmt: number | undefined
    if (type === 'transfer') {
      if (!toAcc) e.toAccount = 'Pilih akun tujuan.'
      else if (toAcc.id === accountId) e.toAccount = 'Akun tujuan harus berbeda dari akun asal.'
      if (crossCurrency) { const v = parseMinor(toAmount, toAcc!.currency); if (!v) e.toAmount = `Masukkan jumlah yang diterima dalam ${toAcc!.currency}.`; else toAmt = v }
    }
    let catId = categoryId
    if (type !== 'transfer' && newCat !== null) {
      if (!newCat.trim()) e.category = 'Nama kategori baru belum diisi.'
      else if (cats.some((c) => c.name.toLowerCase() === newCat.trim().toLowerCase())) e.category = 'Kategori dengan nama itu sudah ada.'
    }
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      if (type !== 'transfer' && newCat !== null) {
        const c: Category = { id: uid(), name: newCat.trim(), type: type === 'income' ? 'income' : 'expense', color: PALETTE[categories.length % PALETTE.length] }
        await saveCategory(c); catId = c.id
      }
      const now = new Date().toISOString()
      const t: Transaction = {
        ...(existing ?? initial ?? {}),
        id: existing?.id ?? uid(), type, amount: amt!, accountId, name: name.trim() || (type === 'transfer' ? `Transfer ke ${toAcc?.name}` : ''),
        categoryId: type === 'transfer' ? undefined : catId || (type === 'income' ? 'inc-lain' : 'exp-lain'),
        toAccountId: type === 'transfer' ? toAccountId : undefined, toAmount: type === 'transfer' ? (toAmt ?? amt!) : undefined,
        date: fromLocalInput(date), note: note.trim(), hasAttachment: photo === 'keep' ? existing?.hasAttachment ?? false : photo instanceof Blob,
        createdAt: existing?.createdAt ?? now, updatedAt: now,
      }
      const r = await saveTransaction(t, photo)
      if (!r.ok) { setErrors({ form: r.error }); return }
      toast(existing ? 'Perubahan disimpan.' : 'Transaksi disimpan.', 'good')
      onClose()
    } finally { setSaving(false) }
  }

  const noAccounts = accounts.length === 0
  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit transaksi' : 'Tambah transaksi'}
      footer={<><button className="btn-secondary" onClick={onClose}>Batal</button><button className="btn-primary" disabled={saving || noAccounts} onClick={submit}>{existing ? 'Simpan perubahan' : 'Simpan transaksi'}</button></>}>
      {noAccounts ? (
        <p className="text-ink-muted">Belum ada akun. Buka <b>Akun Saya</b> dan tambahkan dompet, rekening bank, atau e-wallet sebelum mencatat transaksi.</p>
      ) : (
        <div className="space-y-4">
          <Segmented value={type} onChange={(v) => { setType(v); setCategoryId(''); setNewCat(null) }} options={[{ value: 'expense', label: 'Pengeluaran' }, { value: 'income', label: 'Pemasukan' }, { value: 'transfer', label: 'Transfer' }]} />
          {errors.form && <p className="text-expense text-[13px] card bg-s2 px-3 py-2" role="alert">{errors.form}</p>}

          <Field label={type === 'transfer' ? 'Nominal dikirim' : 'Nominal'} error={errors.amount}>
            <MoneyInput value={amount} onChange={setAmount} currency={acc?.currency ?? 'IDR'} autoFocus />
          </Field>
          <Field label={type === 'transfer' ? 'Keterangan (opsional)' : 'Nama transaksi'} error={errors.name}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'transfer' ? 'Misal: Setor tunai' : type === 'income' ? 'Misal: Gaji Maret' : 'Misal: Makan siang'} maxLength={80} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={type === 'transfer' ? 'Dari akun' : type === 'income' ? 'Masuk ke akun' : 'Bayar dari akun'} error={errors.account}>
              <select className="input" value={accountId} onChange={(e) => { setAccountId(e.target.value); if (e.target.value === toAccountId) setToAccountId('') }}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            {type === 'transfer' ? (
              <Field label="Ke akun" error={errors.toAccount}>
                <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  <option value="">Pilih akun</option>
                  {accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Kategori" error={errors.category}>
                {newCat === null ? (
                  <select className="input" value={categoryId} onChange={(e) => (e.target.value === '__new' ? setNewCat('') : setCategoryId(e.target.value))}>
                    <option value="">{type === 'income' ? 'Lainnya' : 'Lainnya'}</option>
                    {cats.filter((c) => c.name !== 'Lainnya').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="__new">+ Kategori baru…</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input className="input" autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nama kategori" maxLength={30} />
                    <button type="button" className="btn-icon border border-hair" onClick={() => setNewCat(null)} aria-label="Batal buat kategori"><Trash2 size={16} /></button>
                  </div>
                )}
              </Field>
            )}
          </div>

          {crossCurrency && (
            <Field label={`Jumlah diterima (${toAcc!.currency})`} error={errors.toAmount} hint={`Akun asal ${acc!.currency}, akun tujuan ${toAcc!.currency}. Isi jumlah sesuai kurs transfer sebenarnya.`}>
              <MoneyInput value={toAmount} onChange={setToAmount} currency={toAcc!.currency} />
            </Field>
          )}

          <Field label="Tanggal dan waktu" error={errors.date}>
            <input type="datetime-local" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Catatan (opsional)">
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>

          <Field label="Foto bukti (opsional)">
            {photoUrl ? (
              <div className="flex items-center gap-3">
                <img src={photoUrl} alt="Bukti transaksi" className="w-16 h-16 object-cover rounded-md border border-hair" />
                <button type="button" className="btn-ghost text-expense" onClick={() => setPhoto(null)}><Trash2 size={16} />Hapus foto</button>
              </div>
            ) : (
              <label className={cx('btn-secondary cursor-pointer')}>
                <ImagePlus size={16} />Pilih foto
                <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return
                  try { setPhoto(await resizeImage(f)) } catch { toast('Foto tidak dapat dibaca.', 'bad') }
                  e.target.value = ''
                }} />
              </label>
            )}
          </Field>
          {settings.blockNegative && type !== 'income' && <p className="text-caption text-ink-faint flex items-center gap-1.5"><Plus size={12} className="rotate-45" />Pembatasan saldo negatif aktif.</p>}
        </div>
      )}
    </Modal>
  )
}
