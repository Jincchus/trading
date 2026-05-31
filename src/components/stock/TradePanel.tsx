'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import OrderForm from '@/components/orders/OrderForm'
import LotSelector from '@/components/orders/LotSelector'

interface Props {
  ticker: string
}

export default function TradePanel({ ticker }: Props) {
  const [mode, setMode] = useState<'buy' | 'sell' | null>(null)

  const close = () => setMode(null)

  return (
    <>
      <div className="flex gap-3 pb-2">
        <button
          onClick={() => setMode('buy')}
          className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm"
        >
          매수
        </button>
        <button
          onClick={() => setMode('sell')}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm"
        >
          매도
        </button>
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* 배경 딤 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          {/* 모달 */}
          <div className="relative w-full max-w-md bg-gray-950 rounded-t-2xl p-4 pb-8 mb-16 space-y-3 shadow-2xl overflow-y-auto max-h-[80vh]">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-semibold">
                {mode === 'buy' ? '매수 주문' : '매도 주문'} — {ticker}
              </h2>
              <button onClick={close} className="text-gray-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            {mode === 'buy'
              ? <OrderForm defaultTicker={ticker} onSuccess={close} hideTitle />
              : <LotSelector ticker={ticker} onSuccess={close} />
            }
          </div>
        </div>
      )}
    </>
  )
}
