export type SeriesPoint = { time: number; value: number }
export type Period = '7d' | '30d' | 'all'

export function formatUsd(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// 분수(0.024) → "+2.40%"
export function formatPct(fraction: number): string {
  const pct = fraction * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function tabLabel(name: string, id: number): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.length > 0 ? words[words.length - 1] : `#${id}`
}

export function pnlColorClass(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-gray-400'
}

// KST "MM/DD HH:mm"
export function formatKstDateTime(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

// equity 시계열 → budget 대비 퍼센트포인트 (value 단위: %, 예 2.4)
export function buildComparisonSeries(
  history: { timestamp: string; equity: string }[],
  budget: number,
): SeriesPoint[] {
  if (!budget) return []
  return history.map((h) => ({
    time: Math.floor(new Date(h.timestamp).getTime() / 1000),
    value: (parseFloat(h.equity) / budget - 1) * 100,
  }))
}

export function filterByPeriod(series: SeriesPoint[], period: Period, nowSec: number): SeriesPoint[] {
  if (period === 'all') return series
  const days = period === '7d' ? 7 : 30
  const cutoff = nowSec - days * 86400
  return series.filter((p) => p.time >= cutoff)
}
