'use client'

import { useEffect, useState } from 'react'
import { useRealtimePrice } from '@/hooks/useRealtimePrice'

interface SnapshotPrice {
  price: number
}

export default function PriceDisplay({ ticker }: { ticker: string }) {
  const realtime = useRealtimePrice(ticker)
  const [snapshot, setSnapshot] = useState<SnapshotPrice | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/quote`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        if (data.quote) setSnapshot({ price: (data.quote.ap + data.quote.bp) / 2 })
      })
      .catch(() => {})
  }, [ticker])

  const price = realtime?.price ?? snapshot?.price

  if (!price) {
    return <div className="animate-pulse h-16 bg-gray-800 rounded-xl mx-4 mt-2" />
  }

  return (
    <div className="px-4 py-3">
      <p className="text-3xl font-bold text-white">
        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {realtime ? '실시간' : '최근 호가 기준'}
      </p>
    </div>
  )
}
