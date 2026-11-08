import { useState } from 'react'
import { Banknote, Landmark, Pencil, Plus, Smartphone, Trash2, Wallet } from 'lucide-react'
import type { Account, AccountKind, CurrencyCode } from '../lib/types'
import { useApp } from '../store/AppStore'
import { ConfirmDialog, EmptyState, Field, Modal, Money, MoneyInput, PageHeader, Segmented, cx } from '../components/ui'
import { CURRENCIES, formatMoney, minorToInput, parseMinor } from '../lib/money'
import { PALETTE, uid } from '../lib/defaults'
import { effectOn, toBase } from '../lib/calc'
import { formatDate, formatTime } from '../lib/dates'

const KINDS: Record<AccountKind, { label: string; icon: typeof Wallet; examples: string }> = {
  cash: { label: 'Cash', icon: Banknote, examples: 'Dompet, uang tunai di kamar' },
  bank: { label: 'Bank', icon: Landmark, examples: 'BCA, BRI, BNI, Mandiri' },
  ewallet: { label: 'E-Wallet', icon: Smartphone, examples: 'DANA, GoPay, OVO, ShopeePay' },
}

export default function Accounts() {
  const { accounts, balances, transactions, saveAccount, deleteAccount, settings, toast } = useApp()
  const [edit, setEdit] = useState<Account | 'new' | null>(null)
  const [detail, setDetail] = useState<Account | null>(null)
  const [del, setDel] = useState<Account | null>(null)

  const totalOf = (k: AccountKind) => accounts.filter((a) => a.kind === k).reduce((s, a) => s + toBase(balances.get(a.id) ?? 0, a.currency, settings.rates), 0)

  return (
    <>
      <PageHeader title="Akun Saya" subtitle="Tempat Anda menyimpan uang. Saldo dihitung otomatis dari transaksi." actions={<button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} />Tambah akun</button>} />
      {accounts.length === 0 ? (
        <div className="panel"><EmptyState icon={<Wallet size={20} />} title="Belum ada akun" text="Tambahkan dompet tunai, rekening bank, atau e-wallet untuk mulai mencatat." action={<button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} />Tambah akun</button>} /></div>
      ) : (
        <div className="space-y-8">
          {(Object.keys(KINDS) as AccountKind[]).map((k) => {
            const list = accounts.filter((a) => a.kind === k); if (!list.length) return null
            const K = KINDS[k]
            return (
              <section key={k}>
                <div className="flex items-baseline justify-between mb-3"><h2 className="h2 flex items-center gap-2"><K.icon size={16} className="text-ink-subtle" />{K.label}</h2><span className="text-ink-subtle"><Money minor={totalOf(k)} /></span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {list.map((a) => (
                    <div key={a.id} className="card p-4 flex flex-col gap-3 hover:border-hair-strong transition-colors">
                      <button className="text-left flex items-start gap-3" onClick={() => setDetail(a)}>
                        <span className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: a.color + '26', color: a.color }}><K.icon size={18} /></span>
                        <span className="min-w-0 flex-1"><span className="block font-medium truncate">{a.name}</span><span className="block text-caption text-ink-subtle">{a.currency} · dibuat {formatDate(a.createdAt)}</span></span>
                      </button>
                      <p className="text-[22px] font-semibold" style={{ letterSpacing: '-0.5px' }}><Money minor={balances.get(a.id) ?? 0} currency={a.currency} /></p>
                      <div className="flex gap-1 -mb-1 -ml-2">
                        <button className="btn-ghost h-8 px-2" onClick={() => setDetail(a)}>Riwayat</button>
                        <button className="btn-icon" onClick={() => setEdit(a)} aria-label={`Edit ${a.name}`}><Pencil size={15} /></button>
                        <button className="btn-icon" onClick={() => setDel(a)} aria-label={`Hapus ${a.name}`}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <AccountForm account={edit} onClose={() => setEdit(null)} onSave={async (a) => { await saveAccount(a); toast('Akun disimpan.', 'good'); setEdit(null) }} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ''} wide>
        {detail && (() => {
          const txs = transactions.filter((t) => t.accountId === detail.id || t.toAccountId === detail.id).sort((a, b) => +new Date(b.date) - +new Date(a.date))
          return (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="card bg-canvas p-3"><p className="text-caption text-ink-subtle">Saldo saat ini</p><p className="font-semibold text-[18px]"><Money minor={balances.get(detail.id) ?? 0} currency={detail.currency} /></p></div>
                <div className="card bg-canvas p-3"><p className="text-caption text-ink-subtle">Saldo awal</p><p className="font-semibold text-[18px]"><Money minor={detail.openingBalance} currency={detail.currency} /></p></div>
              </div>
              <p className="text-caption text-ink-subtle mb-2">Dibuat {formatDate(detail.createdAt)} · {txs.length} transaksi</p>
              {txs.length === 0 ? <p className="text-ink-subtle py-6 text-center">Belum ada transaksi pada akun ini.</p> : (
                <ul className="card divide-y divide-hair max-h-[46dvh] overflow-y-auto">
                  {txs.map((t) => { const v = effectOn(t, detail.id)
                    return <li key={t.id} className="flex items-center gap-3 px-3 py-2.5"><span className="flex-1 min-w-0"><span className="block truncate">{t.name}</span><span className="text-caption text-ink-subtle">{formatDate(t.date)}, {formatTime(t.date)}</span></span><span className={cx('num font-medium', v > 0 && 'text-income')}>{formatMoney(v, detail.currency, { sign: true })}</span></li> })}
                </ul>
              )}
            </div>
          )
        })()}
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={`Hapus akun ${del?.name}?`}
        message={del && (() => { const n = transactions.filter((t) => t.accountId === del.id || t.toAccountId === del.id).length
          return <>Akun ini beserta <b>{n} transaksi</b> yang terkait (termasuk transfer masuk dan keluar) akan dihapus permanen. Saldo akun lain yang terlibat transfer akan ikut berubah. Pertimbangkan backup sebelum menghapus.</> })()}
        onConfirm={async () => { if (del) { const n = await deleteAccount(del.id); toast(`Akun dan ${n} transaksi dihapus.`, 'info') } }} />
    </>
  )
}

function AccountForm({ account, onClose, onSave }: { account: Account | 'new' | null; onClose: () => void; onSave: (a: Account) => Promise<void> }) {
  const existing = account && account !== 'new' ? account : null
  const { transactions } = useApp()
  const [name, setName] = useState(''), [kind, setKind] = useState<AccountKind>('bank'), [cur, setCur] = useState<CurrencyCode>('IDR')
  const [opening, setOpening] = useState(''), [color, setColor] = useState(PALETTE[0]), [err, setErr] = useState<Record<string, string>>({})
  const [key, setKey] = useState<unknown>(null)
  if (account !== key) {
    setKey(account)
    setName(existing?.name ?? ''); setKind(existing?.kind ?? 'bank'); setCur(existing?.currency ?? 'IDR'); setErr({})
    setOpening(existing ? minorToInput(existing.openingBalance, existing.currency) : ''); setColor(existing?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)])
  }
  const locked = !!existing && transactions.some((t) => t.accountId === existing.id || t.toAccountId === existing.id)
  function submit() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Nama akun wajib diisi.'
    const ob = opening.trim() === '' ? 0 : parseMinor(opening.replace(/^-/, ''), cur)
    if (ob === null) e.opening = 'Saldo awal tidak valid.'
    setErr(e); if (Object.keys(e).length) return
    onSave({ id: existing?.id ?? uid(), name: name.trim(), kind, currency: cur, openingBalance: ob!, color, createdAt: existing?.createdAt ?? new Date().toISOString() })
  }
  return (
    <Modal open={!!account} onClose={onClose} title={existing ? 'Edit akun' : 'Tambah akun'} footer={<><button className="btn-secondary" onClick={onClose}>Batal</button><button className="btn-primary" onClick={submit}>Simpan akun</button></>}>
      <div className="space-y-4">
        <Field label="Jenis akun" hint={KINDS[kind].examples}>
          <Segmented value={kind} onChange={setKind} options={(Object.keys(KINDS) as AccountKind[]).map((k) => ({ value: k, label: KINDS[k].label }))} />
        </Field>
        <Field label="Nama akun" error={err.name}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'cash' ? 'Dompet' : kind === 'bank' ? 'BCA' : 'GoPay'} maxLength={40} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mata uang" hint={locked ? 'Tidak dapat diubah setelah ada transaksi.' : undefined}>
            <select className="input" value={cur} disabled={locked} onChange={(e) => { setCur(e.target.value as CurrencyCode); setOpening('') }}>{Object.entries(CURRENCIES).map(([c, v]) => <option key={c} value={c}>{c} · {v.name}</option>)}</select>
          </Field>
          <Field label="Saldo awal" error={err.opening}><MoneyInput value={opening} onChange={setOpening} currency={cur} /></Field>
        </div>
        <Field label="Warna">
          <div className="flex gap-2 flex-wrap">{PALETTE.map((c) => <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Warna ${c}`} aria-pressed={color === c} className={cx('w-8 h-8 rounded-full border-2 transition-all', color === c ? 'border-ink scale-110' : 'border-transparent')} style={{ background: c }} />)}</div>
        </Field>
      </div>
    </Modal>
  )
}
