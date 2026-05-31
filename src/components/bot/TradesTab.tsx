'use client'

import { Trade } from '@/lib/bot-api'
import { formatUsd, formatKstDateTime } from '@/lib/bot-format'

export default function TradesTab({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-6">체결 내역 없음</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {trades.map((t) => {
        const buy = t.side === 'buy'
        return (
          <div key={t.id} className="bg-gray-900 rounded-lg p-2.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className={`text-[8px] px-1.5 py-0.5 rounded ${buy ? 'bg-emerald-900 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                {buy ? 'BUY' : 'SELL'}
              </span>
              <span className="text-gray-200 text-xs">{t.symbol}</span>
              <span className="text-gray-500 text-[9px]">{parseFloat(t.qty)}주</span>
            </div>
            <div className="text-right">
              <div className="text-gray-300 text-[11px]">{formatUsd(t.price)}</div>
              <div className="text-gray-600 text-[9px]">{formatKstDateTime(t.filled_at)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
