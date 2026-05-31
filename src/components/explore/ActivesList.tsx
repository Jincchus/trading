'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Active {
  symbol: string
  name: string
  changesPercentage: number
  price: number
}

export default function ActivesList() {
  const [actives, setActives] = useState<Active[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/market/actives')
      .then((r) => r.json())
      .then((d) => setActives(d.actives ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-40 bg-gray-800 rounded-xl" />

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <p className="text-gray-400 text-xs uppercase tracking-wide px-4 py-3 border-b border-gray-800">인기 종목</p>
      {actives.slice(0, 8).map((a) => {
        const isUp = a.changesPercentage >= 0
        return (
          <button key={a.symbol} onClick={() => router.push(`/stock/${a.symbol}`)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800">
            <div className="text-left">
              <p className="text-white text-sm font-semibold">{a.symbol}</p>
              <p className="text-xs text-gray-400 truncate max-w-[160px]">{a.name}</p>
            </div>
            <div className="text-right">
              <p className="text-white text-sm">${a.price.toFixed(2)}</p>
              <p className={`text-xs font-medium ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
                {isUp ? '+' : ''}{a.changesPercentage.toFixed(2)}%
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
