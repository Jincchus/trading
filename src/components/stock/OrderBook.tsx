'use client'

import { useEffect, useState } from 'react'

interface Quote {
  ap: number
  as: number
  bp: number
  bs: number
}

export default function OrderBook({ ticker }: { ticker: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    const fetchQuote = () =>
      fetch(`/api/stocks/${ticker}/quote`)
        .then((r) => r.json())
        .then((data) => { if (data.quote) setQuote(data.quote) })
        .catch(() => {})

    fetchQuote()
    const interval = setInterval(fetchQuote, 5000)
    return () => clearInterval(interval)
  }, [ticker])

  if (!quote) return <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />

  const spread = (quote.ap - quote.bp).toFixed(3)

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs mb-3 uppercase tracking-wide">호가</h3>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-gray-400 mb-1">매수 Bid</p>
          <p className="text-green-400 font-semibold text-lg">${quote.bp.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{quote.bs.toLocaleString()} 주</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">스프레드</p>
          <p className="text-gray-300 text-sm">${spread}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">매도 Ask</p>
          <p className="text-red-400 font-semibold text-lg">${quote.ap.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{quote.as.toLocaleString()} 주</p>
        </div>
      </div>
    </div>
  )
}
