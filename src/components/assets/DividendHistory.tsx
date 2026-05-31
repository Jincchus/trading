'use client'

import { useEffect, useState } from 'react'

interface DividendActivity {
  id: string
  date: string
  net_amount: string
  symbol: string
}

export default function DividendHistory() {
  const [dividends, setDividends] = useState<DividendActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/account/activities?type=DIV')
      .then((r) => r.json())
      .then((d) => setDividends(d.activities ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-16 bg-gray-800 rounded-xl" />
  if (dividends.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">배당금 수령 내역</p>
        <p className="text-gray-500 text-sm">수령 내역이 없습니다.</p>
      </div>
    )
  }

  const total = dividends.reduce((s, d) => s + parseFloat(d.net_amount), 0)

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between">
        <p className="text-gray-400 text-xs uppercase tracking-wide">배당금 수령 내역</p>
        <p className="text-red-400 text-xs font-medium">총 ${total.toFixed(2)}</p>
      </div>
      {dividends.map((d) => (
        <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
          <div>
            <p className="text-white text-sm font-medium">{d.symbol}</p>
            <p className="text-xs text-gray-400">{d.date.slice(0, 10)}</p>
          </div>
          <p className="text-red-400 text-sm font-semibold">
            +${parseFloat(d.net_amount).toFixed(2)}
          </p>
        </div>
      ))}
    </div>
  )
}
