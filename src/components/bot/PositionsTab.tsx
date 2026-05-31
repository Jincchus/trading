'use client'

import { Position } from '@/lib/bot-api'
import { formatUsd, formatPct, pnlColorClass } from '@/lib/bot-format'

export default function PositionsTab({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-6">현재 보유 포지션 없음</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {positions.map((p) => {
        const pl = parseFloat(p.unrealized_pl)
        const plpc = parseFloat(p.unrealized_plpc)
        return (
          <div key={p.symbol} className="bg-gray-900 rounded-lg p-2.5 flex justify-between items-center">
            <div>
              <div className="text-white text-sm font-semibold">{p.symbol}</div>
              <div className="text-gray-500 text-[9px]">{parseFloat(p.qty)}주 · 평균 {formatUsd(p.avg_entry_price)}</div>
            </div>
            <div className="text-right">
              <div className={`text-xs font-semibold ${pnlColorClass(pl)}`}>{pl >= 0 ? '+' : ''}{formatUsd(pl)}</div>
              <div className={`text-[9px] ${pnlColorClass(plpc)}`}>{formatPct(plpc)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
