import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, ImagePlus, Info, RefreshCw, ScanLine, Trash2 } from 'lucide-react'
import type { ReceiptItem, Transaction } from '../lib/types'
import { useApp } from '../store/AppStore'
import { useUI } from '../components/layout/Shell'
import { ConfirmDialog, Field, MoneyInput, PageHeader, Progress, cx } from '../components/ui'
import { MAX_IMAGE_BYTES, preprocessForOcr, resizeImage } from '../lib/image'
import { parseReceipt, receiptKey, type ParsedReceipt } from '../lib/receipt/parser'
import type { OcrLine } from '../lib/receipt/ocr'
import { fromLocalInput, nowLocalInput } from '../lib/dates'
import { formatMoney, minorToInput, parseMinor } from '../lib/money'
import { uid } from '../lib/defaults'
import { useNavigate } from 'react-router-dom'

type Step = 'pick' | 'processing' | 'review' | 'error'

export default function Scan() {
  const { accounts, categories, transactions, settings, saveTransaction, toast } = useApp()
  const { openTx } = useUI()
  const nav = useNavigate()
  const [step, setStep] = useState<Step>('pick')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ p: 0, label: '' })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const original = useRef<Blob | null>(null)
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null)
  const [lines, setLines] = useState<OcrLine[]>([])
  const [avgConf, setAvgConf] = useState(0)
  // editable form
  const [merchant, setMerchant] = useState(''), [date, setDate] = useState(nowLocalInput()), [total, setTotal] = useState('')
  const [categoryId, setCategoryId] = useState(''), [accountId, setAccountId] = useState('')
  const [items, setItems] = useState<ReceiptItem[]>([]), [keepImage, setKeepImage] = useState(settings.saveReceiptImage)
  const [errs, setErrs] = useState<Record<string, string>>({}), [dup, setDup] = useState(false), [saving, setSaving] = useState(false)
  const cancelled = useRef(false)

  const idrAccounts = accounts.filter((a) => a.currency === 'IDR')
  const revoke = useCallback(() => setPreviewUrl((u) => { if (u) URL.revokeObjectURL(u); return null }), [])
  useEffect(() => () => { cancelled.current = true; revoke(); original.current = null }, [revoke])

  function reset() { revoke(); original.current = null; setParsed(null); setLines([]); setStep('pick'); setError(''); setErrs({}); setDup(false) }

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('File harus berupa gambar (JPG, PNG, atau HEIC yang didukung browser).'); setStep('error'); return }
    if (file.size > MAX_IMAGE_BYTES) { setError('Ukuran gambar melebihi 15 MB. Gunakan foto yang lebih kecil.'); setStep('error'); return }
    revoke(); original.current = file
    setPreviewUrl(URL.createObjectURL(file)); setStep('processing'); setProgress({ p: 0, label: 'Mengoptimalkan gambar' })
    try {
      const prepared = await preprocessForOcr(file)
      const { runOcr } = await import('../lib/receipt/ocr') // lazy: engine is not part of the initial bundle
      const res = await runOcr(prepared, (p, label) => !cancelled.current && setProgress({ p, label }))
      if (cancelled.current) return
      if (res.text.replace(/\s/g, '').length < 12) throw new Error('Teks pada struk hampir tidak terbaca. Pastikan struk terang, rata, dan memenuhi bingkai foto.')
      const r = parseReceipt(res.text)
      setParsed(r); setLines(res.lines); setAvgConf(res.confidence)
      setMerchant(r.merchant); setDate(r.date ? `${r.date}T${r.time ?? '12:00'}` : nowLocalInput())
      setTotal(r.total !== undefined ? minorToInput(r.total) : ''); setItems(r.items)
      const cat = categories.find((c) => c.id === r.categoryId)
      setCategoryId(cat?.id ?? ''); setAccountId((a) => a || idrAccounts[0]?.id || '')
      setKeepImage(settings.saveReceiptImage); setErrs({}); setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Struk tidak dapat dibaca.'); setStep('error')
    }
  }

  function buildKey() {
    const t = parseMinor(total) ?? 0
    return receiptKey({ merchant, date: date.slice(0, 10), time: date.slice(11, 16), total: t, itemCount: items.length })
  }

  async function save(force = false) {
    const e: Record<string, string> = {}, amt = parseMinor(total)
    if (!amt || amt <= 0) e.total = 'Nominal total wajib diisi dan harus lebih dari 0.'
    if (!accountId) e.account = 'Pilih akun pembayaran.'
    if (!date || isNaN(new Date(date).getTime())) e.date = 'Tanggal tidak valid.'
    setErrs(e); if (Object.keys(e).length) return
    const key = buildKey()
    const exact = transactions.some((t) => t.receiptKey === key)
    const similar = transactions.some((t) => t.type === 'expense' && t.amount === amt && t.date.slice(0, 10) === fromLocalInput(date).slice(0, 10) && merchant && (t.merchant ?? t.name).toLowerCase() === merchant.trim().toLowerCase())
    if (exact) { setErrs({ form: 'Struk ini sudah pernah disimpan (merchant, tanggal, jam, dan total sama).' }); return }
    if (similar && !force) { setDup(true); return }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const clean = items.filter((i) => i.name.trim())
      const t: Transaction = {
        id: uid(), type: 'expense', name: merchant.trim() || 'Struk belanja', merchant: merchant.trim() || undefined, amount: amt!, accountId, categoryId: categoryId || 'exp-lain',
        date: fromLocalInput(date), note: 'Dipindai dari struk', items: clean.length ? clean : undefined, receiptKey: key, hasAttachment: keepImage && !!original.current, createdAt: now, updatedAt: now,
      }
      const att = keepImage && original.current ? await resizeImage(original.current) : 'keep'
      const r = await saveTransaction(t, att)
      if (!r.ok) { setErrs({ form: r.error }); return }
      toast('Transaksi dari struk disimpan.', 'good'); reset(); nav('/transaksi')
    } finally { setSaving(false) }
  }

  const needTotalPick = parsed && parsed.confidence === 'low'
  const sumItems = items.reduce((s, i) => s + i.total, 0)

  return (
    <>
      <PageHeader title="Scan Struk" subtitle="Foto struk dibaca langsung di perangkat Anda. Tidak ada gambar yang dikirim ke server." />

      {step === 'pick' && (
        <div className="max-w-xl">
          {idrAccounts.length === 0 && <p className="card px-4 py-3 mb-4 flex gap-2 text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Tambahkan minimal satu akun bermata uang Rupiah di menu Akun Saya agar hasil scan bisa disimpan.</p>}
          <div className="panel p-6 flex flex-col items-center text-center gap-4">
            <span className="w-12 h-12 rounded-lg bg-s2 border border-hair flex items-center justify-center text-ink-subtle"><ScanLine size={22} /></span>
            <div><h2 className="text-[18px] font-semibold" style={{ letterSpacing: '-0.3px' }}>Pindai struk belanja</h2><p className="text-ink-subtle mt-1">Foto struk dengan pencahayaan cukup, posisi tegak, dan seluruh bagian terlihat.</p></div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <label className="btn-primary cursor-pointer"><Camera size={16} />Ambil foto<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }} /></label>
              <label className="btn-secondary cursor-pointer"><ImagePlus size={16} />Pilih dari galeri<input type="file" accept="image/*" className="sr-only" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }} /></label>
            </div>
            <p className="text-caption text-ink-faint flex items-start gap-1.5 text-left"><Info size={13} className="mt-0.5 shrink-0" />Pembacaan OCR bisa meleset, terutama untuk struk lusuh atau tulisan pudar. Selalu periksa hasilnya sebelum menyimpan. Pertama kali, mesin OCR (±10 MB) dimuat lalu disimpan untuk dipakai offline.</p>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="grid md:grid-cols-[240px_1fr] gap-6 max-w-3xl">
          {previewUrl && <img src={previewUrl} alt="Pratinjau struk" className="rounded-lg border border-hair max-h-[360px] object-contain bg-s1 w-full" />}
          <div className="self-center space-y-3" role="status" aria-live="polite">
            <p className="font-medium">{progress.label}…</p>
            <Progress percent={Math.max(4, progress.p * 100)} />
            <p className="text-ink-subtle text-caption">{Math.round(progress.p * 100)}% · Aplikasi tetap bisa dipakai, proses berjalan di latar.</p>
            <button className="btn-ghost -ml-3.5" onClick={() => { cancelled.current = true; reset(); setTimeout(() => { cancelled.current = false }, 0) }}>Batalkan</button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="panel p-6 max-w-xl">
          <div className="flex gap-3"><AlertTriangle className="text-expense shrink-0 mt-0.5" size={18} /><div><h2 className="font-medium">Struk tidak dapat dibaca</h2><p className="text-ink-muted mt-1">{error}</p><p className="text-ink-subtle mt-1">Tidak ada transaksi yang dibuat.</p></div></div>
          <div className="flex gap-2 mt-5 flex-wrap"><button className="btn-primary" onClick={reset}><RefreshCw size={16} />Scan ulang</button><button className="btn-secondary" onClick={() => { reset(); openTx() }}>Isi manual</button></div>
        </div>
      )}

      {step === 'review' && parsed && (
        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-3">
            {previewUrl && <img src={previewUrl} alt="Struk yang dipindai" className="rounded-lg border border-hair w-full max-h-[420px] object-contain bg-s1" />}
            <button className="btn-secondary w-full" onClick={reset}><RefreshCw size={16} />Scan ulang</button>
            <details className="card text-[13px]"><summary className="px-3 py-2.5 cursor-pointer text-ink-muted">Teks hasil pembacaan ({Math.round(avgConf)}% yakin)</summary>
              <div className="px-3 pb-3 font-mono text-[12px] leading-5 max-h-64 overflow-auto">{lines.map((l, i) => <div key={i} className={cx(l.confidence < 70 && 'bg-warn/20 rounded-xs px-1 -mx-1')} title={l.confidence < 70 ? `Keyakinan rendah (${Math.round(l.confidence)}%)` : undefined}>{l.text}</div>)}</div>
              <p className="px-3 pb-3 text-caption text-ink-faint">Baris yang disorot kuning kurang terbaca.</p></details>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div className="card px-4 py-3 flex gap-2 text-[13px] text-ink-muted"><Info size={15} className="shrink-0 mt-0.5 text-primary" />Hasil OCR mungkin tidak 100% akurat. Periksa dan koreksi sebelum menyimpan.</div>
            {parsed.warnings.map((w) => <p key={w} className="card px-4 py-3 flex gap-2 text-[13px] text-warn"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{w}</p>)}
            {errs.form && <p className="card px-4 py-3 text-expense text-[13px]" role="alert">{errs.form}</p>}

            <Field label="Nama toko / merchant"><input className={cx('input', !parsed.merchant && 'border-warn')} value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={80} placeholder="Nama toko tidak terbaca" /></Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Tanggal dan jam" error={errs.date}><input type="datetime-local" className={cx('input', !parsed.date && 'border-warn')} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Total pembayaran" error={errs.total}><MoneyInput value={total} onChange={setTotal} currency="IDR" /></Field>
            </div>
            {parsed.candidates.length > 0 && (needTotalPick || parsed.candidates.length > 1) && (
              <fieldset className={cx('card p-3', needTotalPick && 'border-warn')}>
                <legend className="px-1 text-caption text-ink-subtle">{needTotalPick ? 'Pilih nominal total yang benar' : 'Kandidat total lain'}</legend>
                <div className="flex flex-wrap gap-2">
                  {parsed.candidates.map((c) => (
                    <button key={c.value} type="button" onClick={() => setTotal(String(c.value))} aria-pressed={parseMinor(total) === c.value}
                      className={cx('btn-secondary h-auto py-2 flex-col items-start gap-0.5', parseMinor(total) === c.value && 'border-primary bg-s2')}>
                      <span className="num">{formatMoney(c.value)}</span><span className="text-caption text-ink-subtle font-normal">{c.label}{c.reasons[0] ? ` · ${c.reasons[0]}` : ''}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Kategori (saran otomatis)"><select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Lainnya</option>{categories.filter((c) => c.type === 'expense' && c.name !== 'Lainnya').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Dibayar dari akun" error={errs.account}><select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Pilih akun</option>{idrAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            </div>

            {(parsed.subtotal || parsed.discount || parsed.tax || parsed.extra || parsed.cash) && (
              <dl className="card px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-[13px]">
                {([['Subtotal', parsed.subtotal], ['Diskon', parsed.discount], ['Pajak', parsed.tax], ['Biaya lain', parsed.extra], ['Tunai / kembali', parsed.cash ? `${formatMoney(parsed.cash)}${parsed.change ? ' / ' + formatMoney(parsed.change) : ''}` : undefined]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-ink-subtle text-caption">{k}</dt><dd className="num">{typeof v === 'number' ? formatMoney(v) : v}</dd></div>)}
              </dl>
            )}

            <div>
              <div className="flex items-center justify-between mb-2"><h3 className="h2">Rincian barang ({items.length})</h3>{items.length > 0 && <span className="text-caption text-ink-subtle num">Jumlah {formatMoney(sumItems)}</span>}</div>
              {items.length === 0 ? <p className="text-ink-subtle text-[13px]">Tidak ada rincian barang yang terbaca. Transaksi tetap bisa disimpan hanya dengan total.</p> : (
                <ul className="card divide-y divide-hair">
                  {items.map((it, i) => (
                    <li key={i} className="grid grid-cols-[1fr_52px_96px_32px] gap-2 items-center px-3 py-2">
                      <input className="input h-9 md:h-9" aria-label="Nama barang" value={it.name} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                      <input className="input h-9 md:h-9 px-2 text-center num" aria-label="Jumlah" inputMode="numeric" value={it.qty} onChange={(e) => { const q = Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1); setItems(items.map((x, k) => (k === i ? { ...x, qty: q, total: x.unitPrice * q } : x))) }} />
                      <input className="input h-9 md:h-9 px-2 text-right num" aria-label="Total harga" inputMode="numeric" value={it.total.toLocaleString('id-ID')} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || 0; setItems(items.map((x, k) => (k === i ? { ...x, total: v, unitPrice: Math.round(v / x.qty) } : x))) }} />
                      <button className="btn-icon w-8 h-8" aria-label="Hapus barang" onClick={() => setItems(items.filter((_, k) => k !== i))}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[rgb(var(--primary))]" checked={keepImage} onChange={(e) => setKeepImage(e.target.checked)} />Simpan foto struk sebagai bukti transaksi</label>
            <div className="flex gap-2 pt-1"><button className="btn-primary" disabled={saving} onClick={() => save()}>Konfirmasi dan simpan</button><button className="btn-ghost" onClick={reset}>Batal</button></div>
          </div>
        </div>
      )}

      <ConfirmDialog open={dup} onClose={() => setDup(false)} tone="primary" confirmLabel="Tetap simpan" title="Mungkin transaksi ganda" message="Sudah ada pengeluaran dengan merchant, tanggal, dan nominal yang sama. Simpan lagi?" onConfirm={() => save(true)} />
    </>
  )
}
