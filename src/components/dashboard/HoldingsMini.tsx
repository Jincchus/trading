'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Position {
  ticker: string
  currentPrice: number
  currentValue: number
  unrealizedPLPct: number
}

export default function HoldingsMini() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((d) => setPositions(d.positions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />
  if (positions.length === 0) return null

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <p className="text-gray-400 text-xs uppercase tracking-wide px-4 py-2.5 border-b border-gray-800">보유 종목</p>
      {positions.slice(0, 3).map((p) => {
        const isUp = p.unrealizedPLPct >= 0
        return (
          <button key={p.ticker} onClick={() => router.push(`/stock/${p.ticker}`)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800">
            <p className="text-white font-semibold text-sm">{p.ticker}</p>
            <div className="text-right">
              <p className="text-white text-sm">${p.currentValue.toFixed(2)}</p>
              <p className={`text-xs ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                {isUp ? '+' : ''}{p.unrealizedPLPct.toFixed(2)}%
              </p>
            </div>
          </button>
        )
      })}
      {positions.length > 3 && (
        <button onClick={() => router.push('/portfolio')} className="w-full py-2.5 text-xs text-blue-400 text-center">
          전체 {positions.length}개 보기
        </button>
      )}
    </div>
  )
}
