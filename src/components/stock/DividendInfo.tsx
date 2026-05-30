'use client'

import { useEffect, useState } from 'react'

interface Dividend {
  date: string
  amount: number
  paymentDate: string
  recordDate: string
}

export default function DividendInfo({ ticker }: { ticker: string }) {
  const [dividends, setDividends] = useState<Dividend[] | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/dividends`)
      .then((r) => r.json())
      .then((data) => setDividends(data.dividends ?? []))
      .catch(() => setDividends([]))
  }, [ticker])

  if (dividends === null) return <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />
  if (dividends.length === 0) return null

  const latest = dividends[0]
  const upcoming = dividends.find((d) => new Date(d.paymentDate) > new Date())

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs mb-3 uppercase tracking-wide">배당금</h3>
      <div className="flex gap-8">
        <div>
          <p className="text-xs text-gray-400 mb-1">최근 배당</p>
          <p className="text-white font-semibold">${latest.amount.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{latest.date}</p>
        </div>
        {upcoming && (
          <div>
            <p className="text-xs text-gray-400 mb-1">다음 지급일</p>
            <p className="text-blue-400 font-semibold">{upcoming.paymentDate}</p>
            <p className="text-xs text-gray-500">${upcoming.amount.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
