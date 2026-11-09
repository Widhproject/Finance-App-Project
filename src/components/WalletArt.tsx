/** Decorative 3D-style wallet used on the balance card. */
export default function WalletArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 140" aria-hidden>
      <defs>
        <linearGradient id="w1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#4c1d95" /></linearGradient>
        <linearGradient id="w2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".6" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
        <linearGradient id="w3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ede9fe" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
        <radialGradient id="w4" cx=".35" cy=".3"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#c4b5fd" /></radialGradient>
      </defs>
      <ellipse cx="82" cy="128" rx="58" ry="8" fill="#1e0a5c" opacity=".35" />
      <g transform="rotate(-12 80 70)">
        <rect x="22" y="30" width="112" height="82" rx="16" fill="url(#w1)" />
        <rect x="22" y="30" width="112" height="82" rx="16" fill="url(#w2)" opacity=".55" />
        <path d="M30 44h86a10 10 0 0 1 10 10" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
        <rect x="94" y="58" width="48" height="32" rx="12" fill="url(#w3)" />
        <rect x="94" y="58" width="48" height="32" rx="12" fill="none" stroke="#fff" strokeOpacity=".7" />
        <circle cx="112" cy="74" r="6.5" fill="url(#w4)" />
      </g>
    </svg>
  )
}
