import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Bell, Database, Download, FileSpreadsheet, FileText, KeyRound, Lock, Moon, Pencil, Plus, ShieldCheck, Sun, Tags, Trash2, Upload } from 'lucide-react'
import type { Category, CurrencyCode } from '../lib/types'
import { useApp } from '../store/AppStore'
import { ConfirmDialog, Dot, Field, Modal, PageHeader, Segmented, cx } from '../components/ui'
import { PinPad } from '../components/PinPad'
import { hashPin, verifyPin } from '../lib/crypto'
import { createBackup } from '../lib/backup'
import { CURRENCIES, DEFAULT_RATES } from '../lib/money'
import { PALETTE, uid } from '../lib/defaults'
import { dayKey, inPeriod, periodFor } from '../lib/dates'
import { download, exportCsv, exportPdf, exportXlsx, transactionRows } from '../lib/export'
import { parseTransactionsCsv, type ImportResult } from '../lib/importCsv'

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="card mb-5"><h2 className="h2 flex items-center gap-2 px-5 h-12 border-b border-hair"><span className="text-ink-subtle">{icon}</span>{title}</h2><div className="divide-y divide-hair">{children}</div></section>
}
function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between"><div className="min-w-0"><p className="font-medium">{title}</p>{hint && <p className="text-caption text-ink-subtle mt-0.5 max-w-md">{hint}</p>}</div><div className="flex gap-2 flex-wrap shrink-0">{children}</div></div>
}

export default function SettingsPage() {
  const { settings, updateSettings, accounts, transactions, categories, balances, toast, lock, restore, importTransactions, resetAll } = useApp()
  const [pinOpen, setPinOpen] = useState(false), [catOpen, setCatOpen] = useState(false), [ratesOpen, setRatesOpen] = useState(false)
  const [range, setRange] = useState<'month' | 'year' | 'all'>('month')
  const [busy, setBusy] = useState('')
  const [restoreData, setRestoreData] = useState<unknown>(null), [imp, setImp] = useState<ImportResult | null>(null)
  const [resetOpen, setResetOpen] = useState(false), [resetText, setResetText] = useState('')
  const backupRef = useRef<HTMLInputElement>(null), csvRef = useRef<HTMLInputElement>(null)

  const scoped = useMemo(() => {
    const p = periodFor(new Date(), settings.monthStartDay)
    if (range === 'all') return { txns: transactions, label: 'Semua waktu', file: 'semua' }
    if (range === 'month') return { txns: transactions.filter((t) => inPeriod(t.date, p)), label: p.label, file: p.key }
    const y = new Date().getFullYear(); return { txns: transactions.filter((t) => new Date(t.date).getFullYear() === y), label: `Tahun ${y}`, file: String(y) }
  }, [range, transactions, settings.monthStartDay])
  const fname = `keuangan-${scoped.file}`

  async function run(label: string, fn: () => Promise<void> | void) { setBusy(label); try { await fn() } catch (e) { toast(e instanceof Error ? e.message : 'Terjadi kesalahan.', 'bad') } finally { setBusy('') } }

  async function notif() {
    if (!('Notification' in window)) return toast('Browser ini tidak mendukung notifikasi. Pengingat tetap tampil di dalam aplikasi.', 'warn')
    const p = await Notification.requestPermission()
    toast(p === 'granted' ? 'Notifikasi browser diaktifkan.' : 'Izin notifikasi ditolak. Pengingat tetap tampil di dalam aplikasi.', p === 'granted' ? 'good' : 'warn')
  }

  return (
    <>
      <PageHeader title="Pengaturan" />

      <Section icon={<ShieldCheck size={16} />} title="Keamanan">
        <Row title="Ubah PIN" hint="Konfirmasi PIN lama diperlukan. PIN disimpan sebagai hash (PBKDF2), bukan teks biasa."><button className="btn-secondary" onClick={() => setPinOpen(true)}><KeyRound size={16} />Ubah PIN</button></Row>
        <Row title="Kunci otomatis" hint="Aplikasi terkunci setelah tidak ada aktivitas.">
          <select className="input w-44" value={settings.autoLockMinutes} onChange={(e) => updateSettings({ autoLockMinutes: Number(e.target.value) })} aria-label="Kunci otomatis">
            {[[1, '1 menit'], [2, '2 menit'], [5, '5 menit'], [15, '15 menit'], [30, '30 menit'], [0, 'Tidak pernah']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Row>
        <Row title="Kunci sekarang"><button className="btn-secondary" onClick={lock}><Lock size={16} />Kunci</button></Row>
        <p className="px-5 py-3 text-caption text-ink-faint">Data tersimpan di perangkat ini (IndexedDB) dan tidak dienkripsi. PIN mengunci tampilan aplikasi, bukan isi penyimpanan browser. Jika nanti memakai database online, tambahkan autentikasi server.</p>
      </Section>

      <Section icon={<Sun size={16} />} title="Tampilan dan keuangan">
        <Row title="Nama panggilan" hint="Dipakai pada sapaan di Dashboard dan inisial profil."><input className="input w-48" value={settings.userName ?? ''} maxLength={24} placeholder="Misal: Bagas" onChange={(e) => updateSettings({ userName: e.target.value })} aria-label="Nama panggilan" /></Row>
        <Row title="Tema"><Segmented value={settings.theme} onChange={(v) => updateSettings({ theme: v })} options={[{ value: 'dark', label: 'Gelap' }, { value: 'light', label: 'Terang' }]} /></Row>
        <Row title="Awal bulan keuangan" hint="Misal gajian tanggal 25: periode berjalan dari tanggal 25 sampai 24 bulan berikutnya.">
          <select className="input w-44" value={settings.monthStartDay} onChange={(e) => updateSettings({ monthStartDay: Number(e.target.value) })} aria-label="Awal bulan keuangan">{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>Tanggal {i + 1}</option>)}</select>
        </Row>
        <Row title="Cegah saldo negatif" hint="Tolak pengeluaran atau transfer yang membuat saldo akun di bawah nol."><Toggle on={settings.blockNegative} onChange={(v) => updateSettings({ blockNegative: v })} label="Cegah saldo negatif" /></Row>
        <Row title="Mata uang dan kurs" hint="IDR adalah mata uang utama. Kurs dipakai untuk menjumlahkan akun bermata uang lain."><button className="btn-secondary" onClick={() => setRatesOpen(true)}>Atur kurs</button></Row>
        <Row title="Kategori" hint="Tambah, ubah, atau hapus kategori sendiri."><button className="btn-secondary" onClick={() => setCatOpen(true)}><Tags size={16} />Kelola kategori</button></Row>
        <Row title="Simpan foto struk" hint="Jika aktif, foto struk hasil scan disimpan sebagai bukti. Jika tidak, gambar dibuang setelah dibaca."><Toggle on={settings.saveReceiptImage} onChange={(v) => updateSettings({ saveReceiptImage: v })} label="Simpan foto struk" /></Row>
      </Section>

      <Section icon={<Bell size={16} />} title="Pengingat">
        <Row title="Ingatkan catat transaksi" hint="Muncul bila belum ada transaksi hari ini. Hanya berjalan saat aplikasi terbuka.">
          <input type="time" className="input w-32" value={settings.reminder.time} onChange={(e) => updateSettings({ reminder: { ...settings.reminder, time: e.target.value } })} aria-label="Jam pengingat" />
          <Toggle on={settings.reminder.enabled} onChange={(v) => updateSettings({ reminder: { ...settings.reminder, enabled: v } })} label="Aktifkan pengingat" />
        </Row>
        <Row title="Notifikasi browser" hint="Izinkan agar pengingat dan peringatan anggaran juga muncul sebagai notifikasi."><button className="btn-secondary" onClick={notif}>{'Notification' in window && Notification.permission === 'granted' ? 'Sudah aktif' : 'Izinkan notifikasi'}</button></Row>
      </Section>

      <Section icon={<Database size={16} />} title="Data">
        <Row title="Ekspor laporan" hint={`Cakupan: ${scoped.label} · ${scoped.txns.length} transaksi`}>
          <select className="input w-40" value={range} onChange={(e) => setRange(e.target.value as typeof range)} aria-label="Cakupan ekspor"><option value="month">Periode ini</option><option value="year">Tahun ini</option><option value="all">Semua</option></select>
          <button className="btn-secondary" disabled={!!busy} onClick={() => exportCsv(transactionRows(scoped.txns, accounts, categories), fname)}><FileText size={16} />CSV</button>
          <button className="btn-secondary" disabled={!!busy} onClick={() => run('xlsx', () => exportXlsx(transactionRows(scoped.txns, accounts, categories), accounts, balances, fname))}><FileSpreadsheet size={16} />Excel</button>
          <button className="btn-secondary" disabled={!!busy} onClick={() => run('pdf', () => exportPdf(scoped.txns, accounts, categories, balances, settings, scoped.label, fname))}><Download size={16} />PDF</button>
        </Row>
        <Row title="Impor transaksi dari CSV" hint="Kolom: Tanggal, Jenis, Nama, Kategori, Akun, Akun tujuan, Nominal, Catatan. Akun harus sudah ada. Baris ganda dilewati.">
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImp(parseTransactionsCsv(await f.text(), accounts, categories, transactions)) }} />
          <button className="btn-secondary" onClick={() => csvRef.current?.click()}><Upload size={16} />Pilih file CSV</button>
        </Row>
        <Row title="Backup data" hint="Semua akun, transaksi, kategori, anggaran, target, transaksi berulang, catatan, pengaturan, dan foto bukti. PIN tidak ikut disimpan.">
          <button className="btn-secondary" disabled={!!busy} onClick={() => run('backup', async () => { download(`backup-keuangan-${dayKey(new Date())}.json`, JSON.stringify(await createBackup()), 'application/json'); toast('Backup diunduh. Simpan di tempat aman.', 'good') })}><Download size={16} />Unduh backup</button>
        </Row>
        <Row title="Restore dari backup" hint="Mengganti seluruh data saat ini dengan isi file backup.">
          <input ref={backupRef} type="file" accept=".json,application/json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setRestoreData(JSON.parse(await f.text())) } catch { toast('File bukan JSON yang valid.', 'bad') } }} />
          <button className="btn-secondary" onClick={() => backupRef.current?.click()}><Upload size={16} />Pilih file backup</button>
        </Row>
        <Row title="Hapus semua data" hint="Menghapus seluruh data keuangan di perangkat ini. PIN tetap dipakai."><button className="btn-secondary text-expense" onClick={() => { setResetText(''); setResetOpen(true) }}><Trash2 size={16} />Hapus semua</button></Row>
      </Section>

      <ChangePin open={pinOpen} onClose={() => setPinOpen(false)} />
      <CategoryManager open={catOpen} onClose={() => setCatOpen(false)} />
      <Rates open={ratesOpen} onClose={() => setRatesOpen(false)} />

      <ConfirmDialog open={!!restoreData} onClose={() => setRestoreData(null)} tone="primary" confirmLabel="Restore sekarang" title="Restore backup?"
        message="Seluruh data saat ini akan diganti dengan isi file backup. Disarankan mengunduh backup data saat ini lebih dulu." onConfirm={async () => { try { await restore(restoreData); toast('Data berhasil dipulihkan.', 'good') } catch (e) { toast(e instanceof Error ? e.message : 'Restore gagal.', 'bad') } }} />

      <Modal open={!!imp} onClose={() => setImp(null)} title="Pratinjau impor" footer={<><button className="btn-secondary" onClick={() => setImp(null)}>Batal</button><button className="btn-primary" disabled={!imp?.valid.length} onClick={async () => { if (imp) { await importTransactions(imp.valid, imp.newCategories); toast(`${imp.valid.length} transaksi diimpor.`, 'good'); setImp(null) } }}>Impor {imp?.valid.length ?? 0} transaksi</button></>}>
        {imp && <div className="space-y-3">
          <p><b>{imp.valid.length}</b> transaksi siap diimpor{imp.duplicates > 0 && <>, <b>{imp.duplicates}</b> dilewati karena sudah ada</>}{imp.newCategories.length > 0 && <>, <b>{imp.newCategories.length}</b> kategori baru dibuat</>}.</p>
          {imp.errors.length > 0 && <div><p className="text-expense mb-1">{imp.errors.length} baris bermasalah (tidak diimpor):</p><ul className="card divide-y divide-hair max-h-48 overflow-y-auto text-[13px]">{imp.errors.slice(0, 50).map((e, i) => <li key={i} className="px-3 py-1.5"><span className="text-ink-subtle">Baris {e.row}:</span> {e.message}</li>)}</ul></div>}
        </div>}
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Hapus semua data?" footer={<><button className="btn-secondary" onClick={() => setResetOpen(false)}>Batal</button><button className="btn-danger" disabled={resetText !== 'HAPUS'} onClick={async () => { await resetAll(); setResetOpen(false); toast('Semua data dihapus.', 'info') }}>Hapus permanen</button></>}>
        <p className="text-ink-muted mb-4">Akun, transaksi, anggaran, target, dan catatan akan dihapus permanen. Unduh backup lebih dulu bila perlu.</p>
        <Field label='Ketik "HAPUS" untuk melanjutkan'><input className="input" value={resetText} onChange={(e) => setResetText(e.target.value)} autoComplete="off" /></Field>
      </Modal>
    </>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative w-11 h-6 rounded-full border transition-colors shrink-0', on ? 'bg-primary border-primary' : 'bg-s3 border-hair-strong')}><span className={cx('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} /></button>
}

function ChangePin({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, toast } = useApp()
  const [step, setStep] = useState<'old' | 'new' | 'confirm'>('old'), [fresh, setFresh] = useState('')
  const close = () => { setStep('old'); setFresh(''); onClose() }
  return (
    <Modal open={open} onClose={close} title="Ubah PIN">
      <PinPad key={step} compact title={step === 'old' ? 'PIN lama' : step === 'new' ? 'PIN baru' : 'Ulangi PIN baru'} subtitle={step === 'old' ? 'Masukkan PIN saat ini untuk melanjutkan.' : step === 'new' ? 'Pilih 6 digit PIN baru.' : 'Masukkan PIN baru sekali lagi.'}
        onComplete={async (pin) => {
          if (step === 'old') { if (!(await verifyPin(pin, settings))) return 'PIN lama salah.'; setStep('new'); return null }
          if (step === 'new') { if (await verifyPin(pin, settings)) return 'PIN baru harus berbeda dari PIN lama.'; setFresh(pin); setStep('confirm'); return null }
          if (pin !== fresh) { setStep('new'); return 'PIN tidak sama. Ulangi dari awal.' }
          await updateSettings(await hashPin(pin)); toast('PIN berhasil diubah.', 'good'); close(); return null
        }} />
    </Modal>
  )
}

function Rates({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, toast } = useApp()
  const others = (Object.keys(CURRENCIES) as CurrencyCode[]).filter((c) => c !== 'IDR')
  const [vals, setVals] = useState<Record<string, string>>({})
  const [k, setK] = useState(false)
  if (open !== k) { setK(open); if (open) setVals(Object.fromEntries(others.map((c) => [c, String(settings.rates[c] ?? DEFAULT_RATES[c])]))) }
  return (
    <Modal open={open} onClose={onClose} title="Kurs terhadap Rupiah" footer={<><button className="btn-secondary" onClick={onClose}>Batal</button><button className="btn-primary" onClick={async () => {
      const rates: Settings2 = {}; for (const c of others) { const n = Number(vals[c].replace(',', '.')); if (!(n > 0)) return toast(`Kurs ${c} tidak valid.`, 'bad'); rates[c] = n }
      await updateSettings({ rates }); toast('Kurs disimpan.', 'good'); onClose() }}>Simpan kurs</button></>}>
      <p className="text-ink-muted mb-4">Berapa Rupiah untuk 1 unit mata uang. Kurs hanya dipakai untuk total dan laporan; saldo akun tetap dalam mata uangnya sendiri. Perbarui manual sesuai kebutuhan.</p>
      <div className="space-y-3">{others.map((c) => <Field key={c} label={`1 ${c} (${CURRENCIES[c].name})`}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">Rp</span><input className="input num" style={{ paddingLeft: 40 }} inputMode="decimal" value={vals[c] ?? ''} onChange={(e) => setVals({ ...vals, [c]: e.target.value })} /></div></Field>)}</div>
    </Modal>
  )
}
type Settings2 = Partial<Record<CurrencyCode, number>>

function CategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, saveCategory, deleteCategory, toast, transactions } = useApp()
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [edit, setEdit] = useState<Category | null>(null), [name, setName] = useState(''), [color, setColor] = useState(PALETTE[0]), [err, setErr] = useState('')
  const [del, setDel] = useState<Category | null>(null)
  const list = categories.filter((c) => c.type === kind)
  const startNew = () => { setEdit({ id: '', name: '', type: kind, color: PALETTE[categories.length % PALETTE.length] }); setName(''); setColor(PALETTE[categories.length % PALETTE.length]); setErr('') }
  async function save() {
    if (!edit) return
    if (!name.trim()) return setErr('Nama kategori wajib diisi.')
    if (categories.some((c) => c.id !== edit.id && c.type === edit.type && c.name.toLowerCase() === name.trim().toLowerCase())) return setErr('Nama kategori sudah dipakai.')
    await saveCategory({ ...edit, id: edit.id || uid(), name: name.trim(), color }); toast('Kategori disimpan.', 'good'); setEdit(null)
  }
  return (
    <>
      <Modal open={open && !edit} onClose={onClose} title="Kategori" footer={<button className="btn-primary" onClick={startNew}><Plus size={16} />Kategori baru</button>}>
        <Segmented className="mb-4" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Pengeluaran' }, { value: 'income', label: 'Pemasukan' }]} />
        <ul className="card divide-y divide-hair">
          {list.map((c) => <li key={c.id} className="flex items-center gap-3 px-3 py-2.5"><Dot color={c.color} size={10} /><span className="flex-1 truncate">{c.name}</span><span className="text-caption text-ink-faint">{transactions.filter((t) => t.categoryId === c.id).length}</span>
            <button className="btn-icon" aria-label={`Edit ${c.name}`} onClick={() => { setEdit(c); setName(c.name); setColor(c.color); setErr('') }}><Pencil size={14} /></button>
            {!c.builtin && <button className="btn-icon" aria-label={`Hapus ${c.name}`} onClick={() => setDel(c)}><Trash2 size={14} /></button>}</li>)}
        </ul>
      </Modal>
      <Modal open={open && !!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit kategori' : 'Kategori baru'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Batal</button><button className="btn-primary" onClick={save}>Simpan</button></>}>
        <div className="space-y-4"><Field label="Nama" error={err}><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></Field>
          <Field label="Warna"><div className="flex gap-2 flex-wrap">{PALETTE.map((c) => <button key={c} type="button" aria-label={`Warna ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} className={cx('w-8 h-8 rounded-full border-2', c === color ? 'border-ink' : 'border-transparent')} style={{ background: c }} />)}</div></Field></div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title={`Hapus kategori ${del?.name}?`} message="Transaksi dalam kategori ini dipindahkan ke “Lainnya” dan anggarannya dihapus." onConfirm={async () => { if (del) await deleteCategory(del.id) }} />
    </>
  )
}
