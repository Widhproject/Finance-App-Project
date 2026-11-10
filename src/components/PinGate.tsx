import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../store/AppStore'
import { PinPad } from './PinPad'
import Logo from './Logo'
import { hashPin, verifyPin } from '../lib/crypto'

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-10 pt-safe pb-safe">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="flex flex-col items-center gap-2 mb-8"><Logo size={56} /><span className="text-[20px] font-semibold" style={{ letterSpacing: '-0.4px' }}>duitku</span></div>
        {children}
      </div>
    </div>
  )
}

function Setup() {
  const { updateSettings, unlock } = useApp()
  const [first, setFirst] = useState<string | null>(null)
  return (
    <Frame>
      <PinPad key={first ? 'confirm' : 'new'} title={first ? 'Ulangi PIN' : 'Buat PIN 6 digit'}
        subtitle={first ? 'Masukkan PIN yang sama sekali lagi.' : 'PIN melindungi data keuangan di perangkat ini. Jangan sampai lupa: PIN tidak bisa dipulihkan.'}
        onComplete={async (pin) => {
          if (!first) { setFirst(pin); return null }
          if (pin !== first) { setFirst(null); return 'PIN tidak sama. Mulai lagi.' }
          await updateSettings({ ...(await hashPin(pin)), failedAttempts: 0, lockUntil: 0 })
          unlock(); return null
        }} />
    </Frame>
  )
}

function Lock() {
  const { settings, updateSettings, unlock } = useApp()
  const [now, setNow] = useState(Date.now())
  const wait = Math.max(0, Math.ceil((settings.lockUntil - now) / 1000))
  useEffect(() => { if (settings.lockUntil <= Date.now()) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [settings.lockUntil])
  return (
    <Frame>
      <PinPad title="Masukkan PIN" disabled={wait > 0}
        subtitle={wait > 0 ? `Terlalu banyak percobaan. Coba lagi dalam ${wait} detik.` : 'Buka kunci untuk melihat keuangan Anda.'}
        onComplete={async (pin) => {
          if (await verifyPin(pin, settings)) { await updateSettings({ failedAttempts: 0, lockUntil: 0 }); unlock(); return null }
          const fails = settings.failedAttempts + 1
          const lockMs = fails % 5 === 0 ? Math.min(15 * 60_000, 30_000 * 2 ** (fails / 5 - 1)) : 0
          await updateSettings({ failedAttempts: fails, lockUntil: lockMs ? Date.now() + lockMs : 0 }); setNow(Date.now())
          return lockMs ? 'PIN salah. Dikunci sementara.' : `PIN salah. Sisa ${5 - (fails % 5)} percobaan sebelum dikunci sementara.`
        }} />
    </Frame>
  )
}

export default function PinGate({ children }: { children: ReactNode }) {
  const { ready, locked, settings } = useApp()
  if (!ready) return <div className="min-h-dvh" />
  if (!settings.pinHash) return <Setup />
  if (locked) return <Lock />
  return <>{children}</>
}
