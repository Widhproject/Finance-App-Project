import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import type { CurrencyCode } from '../lib/types'
import { CURRENCIES, formatMoney } from '../lib/money'
import { useApp } from '../store/AppStore'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
      <div className="min-w-0">
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="text-ink-subtle mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input:not([type=file]),select,textarea')?.focus({ preventScroll: true }), 60)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; clearTimeout(t); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-[#07041a]/75 backdrop-blur-sm" aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={cx('card !bg-s2 !backdrop-blur-none relative w-full sm:rounded-xl rounded-b-none sm:rounded-b-xl max-h-[92dvh] flex flex-col animate-sheet', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-hair shrink-0">
          <h2 id={titleId} className="text-[16px] font-semibold" style={{ letterSpacing: '-0.2px' }}>{title}</h2>
          <button className="btn-icon -mr-2" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-hair flex gap-2 justify-end pb-safe shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Hapus', onConfirm, onClose, tone = 'danger' }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void | Promise<void>; onClose: () => void; tone?: 'danger' | 'primary' }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Batal</button>
        <button className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } onClose() }}>{confirmLabel}</button>
      </>}>
      <div className="flex gap-3">
        {tone === 'danger' && <AlertTriangle size={18} className="text-expense mt-0.5 shrink-0" />}
        <div className="text-ink-muted">{message}</div>
      </div>
    </Modal>
  )
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="text-caption text-expense mt-1.5" role="alert">{error}</p> : hint ? <p className="text-caption text-ink-faint mt-1.5">{hint}</p> : null}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-1 p-1 rounded-full border border-hair w-full sm:w-auto', className)} style={{ background: 'var(--input-bg)', boxShadow: 'var(--input-shadow)' }}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={cx('tab flex-1 sm:flex-none', value === o.value && 'shadow-none')} onClick={() => onChange(o.value)} type="button">{o.label}</button>
      ))}
    </div>
  )
}

/** Amount field. Keeps raw text; thousands separators are shown live for whole-unit currencies. */
export function MoneyInput({ value, onChange, currency, autoFocus, id }: { value: string; onChange: (v: string) => void; currency: CurrencyCode; autoFocus?: boolean; id?: string }) {
  const d = CURRENCIES[currency].decimals
  const display = d === 0 && value ? Number(value.replace(/\D/g, '') || 0).toLocaleString('id-ID') : value
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-[14px] pointer-events-none">{currency === 'IDR' ? 'Rp' : currency}</span>
      <input id={id} className="input num pl-11" style={{ paddingLeft: currency === 'IDR' ? 40 : 48 }} inputMode={d === 0 ? 'numeric' : 'decimal'} autoFocus={autoFocus} placeholder="0" autoComplete="off"
        value={display} onChange={(e) => onChange(d === 0 ? e.target.value.replace(/\D/g, '') : e.target.value.replace(/[^\d.,]/g, ''))} />
    </div>
  )
}

export function Progress({ percent, level, height = 8 }: { percent: number; level?: 0 | 1 | 2 | 3; height?: number }) {
  const fill = level === 3 || level === 2 ? 'linear-gradient(90deg,#ff7a86,#e63950)' : level === 1 ? 'linear-gradient(90deg,#fbbf24,#f59e0b)' : level === 0 ? 'linear-gradient(90deg,#34d399,#14b8a6)' : 'linear-gradient(90deg,#a78bfa,#7c5cff)'
  return (
    <div className="rounded-full overflow-hidden" style={{ height, background: 'var(--track)', boxShadow: 'inset 0 1px 2px rgb(0 0 0 / 0.3)' }} role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: fill, boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.5)' }} />
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="w-12 h-12 rounded-xl card flex items-center justify-center text-primary mb-4">{icon}</div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      <p className="text-ink-subtle mt-1 max-w-sm">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Money shown through the global "hide balance" switch. */
export function Money({ minor, currency = 'IDR', sign, compact, className, always }: { minor: number; currency?: CurrencyCode; sign?: boolean; compact?: boolean; className?: string; always?: boolean }) {
  const { settings } = useApp()
  const hidden = settings.hideBalance && !always
  return <span className={cx('num', className)}>{hidden ? 'Rp ••••••' : formatMoney(minor, currency, { sign, compact })}</span>
}

export function Button({ variant = 'secondary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button {...p} className={cx(`btn-${variant}`, className)} />
}

export function ToastHost() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="fixed z-[60] left-0 right-0 bottom-24 lg:bottom-6 px-4 flex flex-col items-center gap-2 pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto max-w-md w-full card bg-s3 border-hair-strong px-4 py-3 flex gap-3 items-start animate-sheet">
          {t.tone === 'good' ? <Check size={16} className="text-income mt-0.5 shrink-0" /> : <AlertTriangle size={16} className={cx('mt-0.5 shrink-0', t.tone === 'bad' ? 'text-expense' : t.tone === 'warn' ? 'text-warn' : 'text-primary')} />}
          <p className="flex-1 text-ink">{t.text}</p>
          <button className="text-ink-subtle hover:text-ink" onClick={() => dismissToast(t.id)} aria-label="Tutup"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}

export const Dot = ({ color, size = 8 }: { color: string; size?: number }) => <span className="inline-block rounded-full shrink-0" style={{ background: color, width: size, height: size }} />
