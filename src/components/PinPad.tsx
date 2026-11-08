import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Delete } from 'lucide-react'
import { cx } from './ui'

export const PIN_LENGTH = 6

/** Six indicators + 0–9 keypad. `onComplete` resolves to an error message, or null when accepted. */
export function PinPad({ title, subtitle, onComplete, disabled, children, compact }: { title: string; subtitle?: ReactNode; onComplete: (pin: string) => Promise<string | null> | string | null; disabled?: boolean; children?: ReactNode; compact?: boolean }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const busy = useRef(false)

  const push = useCallback((d: string) => {
    if (disabled || busy.current) return
    setError(null)
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p))
  }, [disabled])
  const back = useCallback(() => { if (!busy.current) setPin((p) => p.slice(0, -1)) }, [])

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || busy.current) return
    busy.current = true
    Promise.resolve(onComplete(pin)).then((err) => {
      if (err) { setError(err); setShake(true); setTimeout(() => setShake(false), 420) }
      setTimeout(() => { setPin(''); busy.current = false }, err ? 380 : 120)
    })
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) push(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [push, back])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
  return (
    <div className="flex flex-col items-center w-full">
      <h1 className={cx('font-semibold text-center', compact ? 'text-[18px]' : 'text-[24px]')} style={{ letterSpacing: '-0.5px' }}>{title}</h1>
      {subtitle && <p className="text-ink-subtle text-center mt-1.5 max-w-[280px]">{subtitle}</p>}
      <div className={cx('flex gap-3.5 my-8', shake && 'animate-shake')} role="status" aria-label={`${pin.length} dari ${PIN_LENGTH} digit`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span key={i} className={cx('w-3.5 h-3.5 rounded-full border transition-all duration-150', i < pin.length ? 'bg-primary border-primary scale-110' : 'border-hair-strong bg-transparent', error && i < pin.length && 'bg-expense border-expense')} />
        ))}
      </div>
      <p className={cx('h-5 text-[13px] text-center -mt-4 mb-4', error ? 'text-expense' : 'text-transparent')} role="alert">{error ?? '.'}</p>
      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[272px]">
        {keys.map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button key={i} type="button" disabled={disabled}
              onClick={() => (k === 'del' ? back() : push(k))}
              aria-label={k === 'del' ? 'Hapus digit' : k}
              className={cx('h-14 rounded-lg border border-hair bg-s1 text-[20px] font-medium num flex items-center justify-center select-none transition-all duration-100 hover:bg-s2 hover:border-hair-strong active:scale-95 active:bg-s3 disabled:opacity-40', k === 'del' && 'text-ink-subtle')}>
              {k === 'del' ? <Delete size={20} /> : k}
            </button>
          ),
        )}
      </div>
      {children}
    </div>
  )
}
