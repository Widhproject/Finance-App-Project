const pad = (n: number) => String(n).padStart(2, '0')

export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
export const todayKey = () => dayKey(new Date())
/** "YYYY-MM-DD" → local Date at 00:00 */
export const fromDayKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }

export const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (s: string) => new Date(s).toISOString()
export const nowLocalInput = () => toLocalInput(new Date().toISOString())

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
export const monthName = (m: number) => MONTHS[m]
export const monthShort = (m: number) => MONTHS_SHORT[m]
export const dayName = (i: number) => DAYS[i]

export const formatDate = (iso: string | Date, withYear = true) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`
}
export const formatTime = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const formatDayHeading = (key: string) => {
  const d = fromDayKey(key)
  const t = todayKey(), y = dayKey(new Date(Date.now() - 864e5))
  const prefix = key === t ? 'Hari ini' : key === y ? 'Kemarin' : DAYS[d.getDay()]
  return `${prefix}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** A financial period. `key` is "YYYY-MM" of the month in which the period starts. */
export interface Period { key: string; start: Date; end: Date; label: string }

export function periodFor(date: Date, startDay: number): Period {
  let y = date.getFullYear(), m = date.getMonth()
  if (date.getDate() < startDay) { m -= 1; if (m < 0) { m = 11; y -= 1 } }
  return periodByKey(`${y}-${pad(m + 1)}`, startDay)
}
export function periodByKey(key: string, startDay: number): Period {
  const [y, m] = key.split('-').map(Number)
  const start = new Date(y, m - 1, startDay)
  const end = new Date(y, m, startDay) // exclusive
  const label = startDay === 1
    ? `${MONTHS[m - 1]} ${y}`
    : `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${new Date(end.getTime() - 864e5).getDate()} ${MONTHS_SHORT[(m) % 12]} ${end.getFullYear()}`
  return { key, start, end, label }
}
export function shiftPeriodKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export const inPeriod = (iso: string, p: Period) => { const t = new Date(iso).getTime(); return t >= p.start.getTime() && t < p.end.getTime() }
export const daysInPeriod = (p: Period) => Math.round((p.end.getTime() - p.start.getTime()) / 864e5)
