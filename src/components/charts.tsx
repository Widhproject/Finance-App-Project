import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../store/AppStore'
import { axisMoney, type SeriesPoint } from '../lib/series'
import { formatMoney } from '../lib/money'

/** Recharts draws SVG attributes, so resolve CSS tokens to concrete colors (re-read when the theme changes). */
export function useChartColors() {
  const { settings } = useApp()
  const [c, setC] = useState({ income: '#22c55e', expense: '#ef4444', primary: '#5e6ad2', muted: '#8a8f98', panel: '#18191a', line: '#23252a', ink: '#f7f8f8', faint: '#34343a' })
  useEffect(() => {
    const s = getComputedStyle(document.documentElement)
    const v = (n: string) => `rgb(${s.getPropertyValue(n).trim().split(/\s+/).join(',')})`
    setC({ income: v('--income'), expense: v('--expense'), primary: v('--primary'), muted: v('--ink-subtle'), panel: v('--surface-3'), line: v('--hairline'), ink: v('--ink'), faint: v('--hairline-strong') })
  }, [settings.theme])
  return c
}

const tip = (c: ReturnType<typeof useChartColors>) => ({
  contentStyle: { background: c.panel, border: `1px solid ${c.faint}`, borderRadius: 8, fontSize: 13, color: c.ink, boxShadow: 'none' },
  labelStyle: { color: c.muted, marginBottom: 4 }, itemStyle: { color: c.ink }, cursor: { fill: 'rgb(255 255 255 / 0.04)' },
})

export function IncomeExpenseChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp()
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={c.line} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} tickFormatter={axisMoney} width={52} />
        <Tooltip {...tip(c)} formatter={(v: number, n: string) => [formatMoney(v), n]} />
        <Bar dataKey="income" name="Pemasukan" fill={c.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" name="Pengeluaran" fill={c.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BalanceChart({ data, height = 240 }: { data: SeriesPoint[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp()
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.line} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} tickFormatter={axisMoney} width={52} domain={['auto', 'auto']} />
        <Tooltip {...tip(c)} formatter={(v: number) => [formatMoney(v), 'Total saldo']} />
        <Line dataKey="balance" name="Total saldo" stroke={c.primary} strokeWidth={2} dot={{ r: 3, fill: c.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export interface Slice { name: string; value: number; color: string }
export function CategoryPie({ data, height = 220 }: { data: Slice[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp()
  const total = data.reduce((a, b) => a + b.value, 0)
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div style={{ width: 200, height }} className="shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip {...tip(c)} formatter={(v: number, n: string) => [`${formatMoney(v)} (${Math.round((v / total) * 100)}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 w-full space-y-2 min-w-0">
        {data.slice(0, 6).map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-[13px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="truncate flex-1 text-ink-muted">{d.name}</span>
            <span className="num text-ink-subtle">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CompareChart({ data, height = 240 }: { data: { name: string; sekarang: number; sebelumnya: number }[]; height?: number }) {
  const c = useChartColors(), { settings } = useApp()
  if (settings.hideBalance) return <Hidden height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={c.line} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 11 }} interval={0} tickFormatter={(s: string) => (s.length > 9 ? s.slice(0, 8) + '…' : s)} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: c.muted, fontSize: 12 }} tickFormatter={axisMoney} width={52} />
        <Tooltip {...tip(c)} formatter={(v: number, n: string) => [formatMoney(v), n]} />
        <Bar dataKey="sebelumnya" name="Periode lalu" fill={c.faint} radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="sekarang" name="Periode ini" fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const Hidden = ({ height }: { height: number }) => <div className="flex items-center justify-center text-ink-faint" style={{ height }}>Nominal disembunyikan</div>
