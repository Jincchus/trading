'use client'

import { Performance } from '@/lib/bot-api'
import { formatPct, pnlColorClass } from '@/lib/bot-format'

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-2.5">
      <div className="text-gray-500 text-[9px]">{label}</div>
      <div className={`text-sm font-bold ${color ?? 'text-gray-200'}`}>{value}</div>
    </div>
  )
}

export default function OverviewTab({ perf }: { perf: Performance | null }) {
  if (!perf) {
    return <p className="text-gray-500 text-sm text-center py-6">장 마감 후 집계됩니다</p>
  }
  const dr = parseFloat(perf.daily_return)
  const win = perf.win_rate != null ? `${(parseFloat(perf.win_rate) * 100).toFixed(0)}%` : '—'
  const sharpe = perf.sharpe_ratio != null ? parseFloat(perf.sharpe_ratio).toFixed(2) : '—'
  const mdd = perf.drawdown != null ? `-${(parseFloat(perf.drawdown) * 100).toFixed(1)}%` : '—'
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Metric label="오늘 수익률" value={formatPct(dr)} color={pnlColorClass(dr)} />
      <Metric label="승률" value={win} />
      <Metric label="Sharpe" value={sharpe} />
      <Metric label="MDD" value={mdd} color={perf.drawdown != null ? 'text-red-400' : undefined} />
    </div>
  )
}
