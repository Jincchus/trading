'use client'

import { useState } from 'react'
import OrderForm from '@/components/orders/OrderForm'
import LotSelector from '@/components/orders/LotSelector'

interface Props {
  ticker: string
}

export default function TradePanel({ ticker }: Props) {
  const [mode, setMode] = useState<'buy' | 'sell' | null>(null)

  if (mode === 'buy') {
    return (
      <div className="space-y-3">
        <button onClick={() => setMode(null)} className="text-xs text-gray-400">← 닫기</button>
        <OrderForm defaultTicker={ticker} onSuccess={() => setMode(null)} />
      </div>
    )
  }

  if (mode === 'sell') {
    return (
      <div className="space-y-3">
        <button onClick={() => setMode(null)} className="text-xs text-gray-400">← 닫기</button>
        <LotSelector ticker={ticker} onSuccess={() => setMode(null)} />
      </div>
    )
  }

  return (
    <div className="flex gap-3 pb-2">
      <button
        onClick={() => setMode('buy')}
        className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm"
      >
        매수
      </button>
      <button
        onClick={() => setMode('sell')}
        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm"
      >
        매도
      </button>
    </div>
  )
}
