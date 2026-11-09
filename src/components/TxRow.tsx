import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import type { Transaction } from '../lib/types'
import { useApp } from '../store/AppStore'
import { useUI } from './layout/Shell'
import { ConfirmDialog, Money, cx } from './ui'
import { formatDate, formatTime } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { iconFor } from '../lib/categoryIcon'

/** One transaction. `expandable` rows reveal note, receipt items, photo and edit/delete actions. */
export default function TxRow({ t, expandable = true, showDate = false }: { t: Transaction; expandable?: boolean; showDate?: boolean }) {
  const { accounts, categories, deleteTransaction, getAttachment, toast } = useApp()
  const { openTx } = useUI()
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState(false)
  const [img, setImg] = useState<string | null>(null)
  const acc = accounts.find((a) => a.id === t.accountId), to = accounts.find((a) => a.id === t.toAccountId)
  const cat = categories.find((c) => c.id === t.categoryId)
  const cur = acc?.currency ?? 'IDR'

  useEffect(() => {
    if (!open || !t.hasAttachment) return
    let url: string | null = null, dead = false
    getAttachment(t.id).then((b) => { if (b && !dead) { url = URL.createObjectURL(b); setImg(url) } })
    return () => { dead = true; if (url) URL.revokeObjectURL(url); setImg(null) }
  }, [open, t.id, t.hasAttachment, getAttachment])

  const Icon = t.type === 'transfer' ? ArrowLeftRight : iconFor(cat?.name ?? t.name)
  const color = t.type === 'transfer' ? '#7c5cff' : cat?.color ?? '#8a8f98'
  const sub = t.type === 'transfer' ? `${acc?.name ?? '?'} → ${to?.name ?? '?'}` : `${cat?.name ?? 'Tanpa kategori'} · ${acc?.name ?? 'Akun dihapus'}`

  return (
    <div className="border-b border-hair last:border-0">
      <button type="button" className={cx('w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left rowhover', !expandable && 'cursor-default')} onClick={() => expandable && setOpen(!open)} aria-expanded={expandable ? open : undefined}>
        <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative" style={{ background: `linear-gradient(145deg, ${color}, ${color}99)`, color: '#fff', boxShadow: 'inset 0 1.5px 0 rgb(255 255 255 / .45), 0 6px 12px -6px ' + color }}><Icon size={17} />{t.type !== 'transfer' && <span className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-s2 flex items-center justify-center">{t.type === 'income' ? <ArrowDownLeft size={9} className="text-income" /> : <ArrowUpRight size={9} className="text-expense" />}</span>}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium truncate">{t.name}</span>
          <span className="block text-caption text-ink-subtle truncate">{sub} · {showDate ? formatDate(t.date, false) + ', ' : ''}{formatTime(t.date)}</span>
        </span>
        <span className={cx('text-right font-medium', t.type === 'income' && 'text-income', t.type === 'expense' && 'text-expense', t.type === 'transfer' && 'text-ink-muted')}>
          <Money minor={t.type === 'expense' ? -t.amount : t.amount} currency={cur} sign={t.type === 'income'} />
        </span>
        {expandable && <ChevronDown size={14} className={cx('text-ink-faint transition-transform shrink-0', open && 'rotate-180')} />}
      </button>
      {open && (
        <div className="px-4 sm:pl-[64px] pb-4 space-y-3 text-[13px] animate-fade">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-muted">
            <dt className="text-ink-subtle">Waktu</dt><dd>{formatDate(t.date)}, {formatTime(t.date)}</dd>
            {t.merchant && <><dt className="text-ink-subtle">Merchant</dt><dd>{t.merchant}</dd></>}
            {t.type === 'transfer' && t.toAmount !== undefined && to && to.currency !== cur && <><dt className="text-ink-subtle">Diterima</dt><dd className="num">{formatMoney(t.toAmount, to.currency)}</dd></>}
            {t.note && <><dt className="text-ink-subtle">Catatan</dt><dd className="whitespace-pre-wrap">{t.note}</dd></>}
            {t.recurringId && <><dt className="text-ink-subtle">Sumber</dt><dd>Transaksi berulang</dd></>}
          </dl>
          {t.items && t.items.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-[13px]"><thead><tr className="text-ink-subtle text-left"><th className="px-3 py-2 font-normal">Barang</th><th className="px-2 py-2 font-normal text-right">Qty</th><th className="px-3 py-2 font-normal text-right">Total</th></tr></thead>
                <tbody>{t.items.map((i, k) => <tr key={k} className="border-t border-hair"><td className="px-3 py-1.5">{i.name}</td><td className="px-2 text-right num">{i.qty}</td><td className="px-3 text-right num">{formatMoney(i.total)}</td></tr>)}</tbody></table>
            </div>
          )}
          {img && <img src={img} alt="Bukti transaksi" className="max-h-64 rounded-md border border-hair" />}
          <div className="flex gap-2">
            <button className="btn-secondary h-9" onClick={() => openTx(t)}><Pencil size={14} />Edit</button>
            <button className="btn-ghost h-9 text-expense" onClick={() => setDel(true)}><Trash2 size={14} />Hapus</button>
          </div>
        </div>
      )}
      <ConfirmDialog open={del} onClose={() => setDel(false)} title="Hapus transaksi?" message={<>“{t.name}” akan dihapus dan saldo akun otomatis dihitung ulang. Tindakan ini tidak bisa dibatalkan.</>}
        onConfirm={async () => { await deleteTransaction(t.id); toast('Transaksi dihapus.', 'info') }} />
    </div>
  )
}
