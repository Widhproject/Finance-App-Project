import { useEffect, useId, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../store/AppStore'
import { axisMoney, type SeriesPoint } from '../lib/series'
import { formatMoney } from '../lib/money'
import { iconFor } from '../lib/categoryIcon'

/** Recharts draws SVG attributes, so resolve CSS tokens to concrete colors (re-read when the theme changes). */
export function useChartColors() {
  const { settings } = useApp()
  const [c, setC] = useState({ income: '#34d378', expense: '#ff6470', primary: '#7c5cff', muted: '#a298c8', panel: '#2f245c', line: '#3e326c', ink: '#f8f6ff', faint: '#5c4e9c' })
  useEffect(() => {
    const s = getComputedStyle(document.documentElement)
    const v = (n: string) => `rgb(${s.getPropertyValue(n).trim().split(/\s+/).join(',')})`
    setC({ income: v('--income'), expense: v('--expense'), primary: v('--primary'), muted: v('--ink-subtle'), panel: v('--surface-3'), line: v('--hairline'), ink: v('--ink'), faint: v('--hairline-strong') })
  }, [settings.theme])
  return c
}

const tip = (c: ReturnType<typeof useChartColors>) => ({
  contentStyle: { background: c.panel, border: `1px solid ${c.faint}`, borderRadius: 12, fontSize: 13, color: c.ink, boxShadow: '0 12px 28px -8px rgb(0 0 0 / .6)' },
  labelStyle: { color: c.muted, marginBottom: 4 }, itemStyle: { color: c.ink }, cursor: { fill: 'rgb(124 92 255 / 0.1)' },
})

export function IncomeExpenseChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp(), id = useId().replace(/:/g, '')
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={6}>
        <defs>
          <linearGradient id={`inc${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4ade80" /><stop offset="1" stopColor="#0d9488" /></linearGradient>
          <linearGradient id={`exp${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#6d4aff" /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 5" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} tickFormatter={axisMoney} width={52} />
        <Tooltip {...tip(c)} formatter={(v: number, n: string) => [formatMoney(v), n]} />
        <Bar isAnimationActive={false} dataKey="income" name="Pemasukan" fill={`url(#inc${id})`} radius={[6, 6, 2, 2]} maxBarSize={26} />
        <Bar isAnimationActive={false} dataKey="expense" name="Pengeluaran" fill={`url(#exp${id})`} radius={[6, 6, 2, 2]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BalanceChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp(), id = useId().replace(/:/g, '')
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs><linearGradient id={`bal${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b6bff" stopOpacity=".55" /><stop offset="1" stopColor="#8b6bff" stopOpacity="0" /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 5" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} tickFormatter={axisMoney} width={52} domain={['auto', 'auto']} />
        <Tooltip {...tip(c)} formatter={(v: number) => [formatMoney(v), 'Total saldo']} />
        <Area isAnimationActive={false} dataKey="balance" name="Total saldo" type="monotone" stroke="#a78bfa" strokeWidth={2.5} fill={`url(#bal${id})`} dot={{ r: 3, fill: '#c4b5fd', strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export interface Slice { name: string; value: number; color: string }
export function CategoryPie({ data, height = 190 }: { data: Slice[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp()
  const total = data.reduce((a, b) => a + b.value, 0)
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="96%" paddingAngle={data.length > 1 ? 3 : 0} cornerRadius={6} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip {...tip(c)} formatter={(v: number, n: string) => [`${formatMoney(v)} (${Math.round((v / total) * 100)}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[18px] font-semibold num" style={{ letterSpacing: '-0.4px' }}>{formatMoney(total, 'IDR', { compact: true })}</span>
          <span className="text-caption text-ink-subtle">Total</span>
        </div>
      </div>
      <ul className="flex-1 w-full space-y-2.5 min-w-0">
        {data.slice(0, 5).map((d) => { const I = iconFor(d.name); return (
          <li key={d.name} className="flex items-center gap-2.5 text-[13px]">
            <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: d.color + '2e', color: d.color }}><I size={13} /></span>
            <span className="truncate flex-1 text-ink-muted">{d.name}</span>
            <span className="num text-ink-subtle">{Math.round((d.value / total) * 100)}%</span>
          </li>) })}
      </ul>
    </div>
  )
}

export function CompareChart({ data, height = 240 }: { data: { name: string; sekarang: number; sebelumnya: number }[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp(), id = useId().replace(/:/g, '')
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={6}>
        <defs><linearGradient id={`cmp${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#6d4aff" /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="3 5" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 11 }} interval={0} tickFormatter={(s: string) => (s.length > 9 ? s.slice(0, 8) + '…' : s)} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} tickFormatter={axisMoney} width={52} />
        <Tooltip {...tip(c)} formatter={(v: number, n: string) => [formatMoney(v), n]} />
        <Bar isAnimationActive={false} dataKey="sebelumnya" name="Periode lalu" fill={c.faint} radius={[6, 6, 2, 2]} maxBarSize={20} />
        <Bar isAnimationActive={false} dataKey="sekarang" name="Periode ini" fill={`url(#cmp${id})`} radius={[6, 6, 2, 2]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const Hidden = ({ height }: { height: number }) => <div className="flex items-center justify-center text-ink-faint" style={{ height }}>Nominal disembunyikan</div>
