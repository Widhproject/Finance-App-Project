import { useId } from 'react'

export default function Logo({ size = 36 }: { size?: number }) {
  const id = 'lg' + useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c4b5fd" /><stop offset="1" stopColor="#7c5cff" /></linearGradient></defs>
      <path d="M8 26a16 16 0 0 1 32 0" fill="none" stroke={`url(#${id})`} strokeWidth="4" strokeLinecap="round" />
      <rect x="14" y="24" width="5" height="16" rx="2.5" fill={`url(#${id})`} /><rect x="21.5" y="18" width="5" height="22" rx="2.5" fill={`url(#${id})`} /><rect x="29" y="21" width="5" height="19" rx="2.5" fill={`url(#${id})`} />
    </svg>
  )
}
