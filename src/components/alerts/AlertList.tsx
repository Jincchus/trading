'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Alert {
  id: string
  ticker: string
  targetPrice: number
  direction: string
  active: boolean
  createdAt: string
}

interface Props { refreshKey?: number }

export default function AlertList({ refreshKey }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([])

  const load = () =>
    fetch('/api/alerts').then((r) => r.json()).then((d) => setAlerts(d.alerts ?? []))

  useEffect(() => { load() }, [refreshKey])

  const remove = async (id: string) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    load()
  }

  if (alerts.length === 0) return <p className="text-gray-500 text-sm text-center py-4">설정된 알림이 없습니다.</p>

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {alerts.map((a) => (
        <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
          <div>
            <p className="text-white text-sm font-medium">{a.ticker}</p>
            <p className="text-xs text-gray-400">${a.targetPrice.toFixed(2)} {a.direction === 'above' ? '이상' : '이하'} 시 알림</p>
          </div>
          <button onClick={() => remove(a.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}
