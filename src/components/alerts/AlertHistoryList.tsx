'use client'

import { useEffect, useState } from 'react'

interface AlertHistoryItem {
  id: string
  triggeredAt: string
  price: number
  alert: { ticker: string; targetPrice: number; direction: string }
}

export default function AlertHistoryList() {
  const [history, setHistory] = useState<AlertHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/alerts?history=true')
      .then((r) => r.json())
      .then((d) => { setHistory(d.history ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-16 bg-gray-800 rounded-xl" />
  if (history.length === 0) return <p className="text-gray-500 text-sm text-center py-4">알림 내역이 없습니다.</p>

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {history.map((h) => (
        <div key={h.id} className="px-4 py-3 border-b border-gray-800 last:border-0">
          <div className="flex justify-between">
            <p className="text-white text-sm font-medium">{h.alert.ticker}</p>
            <p className="text-xs text-gray-400">{h.triggeredAt.slice(0, 10)}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">${h.price.toFixed(2)} 도달 (목표: ${h.alert.targetPrice.toFixed(2)} {h.alert.direction === 'above' ? '이상' : '이하'})</p>
        </div>
      ))}
    </div>
  )
}
