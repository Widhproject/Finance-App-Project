import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store/AppStore'
import { shiftPeriodKey } from '../lib/dates'

export default function PeriodPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const { periodOf, period } = useApp()
  return (
    <div className="flex items-center gap-1 card px-1 h-11 md:h-10">
      <button className="btn-icon" onClick={() => onChange(shiftPeriodKey(value, -1))} aria-label="Periode sebelumnya"><ChevronLeft size={16} /></button>
      <button className="px-2 min-w-[132px] text-center font-medium text-[14px]" onClick={() => onChange(period.key)} title="Kembali ke periode ini">{periodOf(value).label}</button>
      <button className="btn-icon" onClick={() => onChange(shiftPeriodKey(value, 1))} aria-label="Periode berikutnya"><ChevronRight size={16} /></button>
    </div>
  )
}
