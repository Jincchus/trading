'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import LotRow from './LotRow'

interface LotDetail {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  status: string
  strategyId: string | null
}

interface Props {
  ticker: string
  qty: number
  currentPrice: number
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  lots: LotDetail[]
  categories: string[]
}

export default function PositionCard(props: Props) {
  const [expanded, setExpanded] = useState(false)
  const isUp = props.unrealizedPL >= 0

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-base">{props.ticker}</p>
              {expanded
                ? <ChevronUp size={14} className="text-gray-500" />
                : <ChevronDown size={14} className="text-gray-500" />}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {props.qty}주 · ${props.currentPrice.toFixed(2)}
            </p>
            {props.categories.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {props.categories.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded-full"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-white font-semibold">
              ${props.currentValue.toFixed(2)}
            </p>
            <p className={`text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{props.unrealizedPLPct.toFixed(2)}%
            </p>
          </div>
        </div>
      </button>

      {expanded && props.lots.length > 0 && (
        <div className="border-t border-gray-800">
          {props.lots.map((lot) => (
            <LotRow key={lot.id} lot={lot} />
          ))}
        </div>
      )}
    </div>
  )
}
