import { useState } from 'react'
import { NotebookPen, Plus, Trash2 } from 'lucide-react'
import type { Note } from '../lib/types'
import { useApp } from '../store/AppStore'
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader } from '../components/ui'
import { formatDate } from '../lib/dates'
import { uid } from '../lib/defaults'

export default function Notes() {
  const { notes, saveNote, deleteNote, toast } = useApp()
  const [edit, setEdit] = useState<Note | 'new' | null>(null)
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [err, setErr] = useState('')
  const [del, setDel] = useState<Note | null>(null)
  const open = (n: Note | 'new') => { setEdit(n); setErr(''); setTitle(n === 'new' ? '' : n.title); setBody(n === 'new' ? '' : n.body) }
  async function save() {
    if (!title.trim() && !body.trim()) return setErr('Isi judul atau catatan terlebih dahulu.')
    const now = new Date().toISOString(), base = edit !== 'new' && edit ? edit : { id: uid(), createdAt: now }
    await saveNote({ ...base, title: title.trim() || 'Tanpa judul', body: body.trim(), updatedAt: now }); toast('Catatan disimpan.', 'good'); setEdit(null)
  }
  const sorted = [...notes].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  return (
    <>
      <PageHeader title="Catatan" subtitle="Catatan keuangan bebas: rencana, utang piutang, atau pengingat." actions={<button className="btn-primary" onClick={() => open('new')}><Plus size={16} />Catatan baru</button>} />
      {sorted.length === 0 ? <div className="panel"><EmptyState icon={<NotebookPen size={20} />} title="Belum ada catatan" text="Simpan hal yang perlu diingat soal keuangan Anda." action={<button className="btn-primary" onClick={() => open('new')}><Plus size={16} />Catatan baru</button>} /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map((n) => (
            <div key={n.id} className="card p-4 flex flex-col gap-2 hover:border-hair-strong transition-colors">
              <button className="text-left flex-1" onClick={() => open(n)}><h3 className="font-medium truncate">{n.title}</h3><p className="text-ink-muted mt-1 line-clamp-4 whitespace-pre-wrap">{n.body}</p></button>
              <div className="flex items-center justify-between"><span className="text-caption text-ink-faint">{formatDate(n.updatedAt)}</span><button className="btn-icon -mr-2" aria-label="Hapus catatan" onClick={() => setDel(n)}><Trash2 size={15} /></button></div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Catatan baru' : 'Edit catatan'} footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Batal</button><button className="btn-primary" onClick={save}>Simpan catatan</button></>}>
        <div className="space-y-4">{err && <p className="text-expense text-[13px]" role="alert">{err}</p>}
          <Field label="Judul"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></Field>
          <Field label="Isi catatan"><textarea className="input" rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} /></Field></div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} title="Hapus catatan?" message={<>“{del?.title}” akan dihapus permanen.</>} onConfirm={async () => { if (del) await deleteNote(del.id) }} />
    </>
  )
}
