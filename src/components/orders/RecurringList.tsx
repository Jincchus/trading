'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Recurring {
  id: string
  ticker: string
  amount: number
  frequency: string
  active: boolean
  lastRun: string | null
}

const FREQ_LABEL: Record<string, string> = { daily: '매일', weekly: '매주', monthly: '매월' }

interface Props {
  refreshKey?: number
}

export default function RecurringList({ refreshKey }: Props) {
  const [items, setItems] = useState<Recurring[]>([])

  const load = () =>
    fetch('/api/recurring').then((r) => r.json()).then((d) => setItems(d.recurring ?? []))

  useEffect(() => { load() }, [refreshKey])

  const remove = async (id: string) => {
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
    load()
  }

  const toggle = async (id: string, active: boolean) => {
    await fetch(`/api/recurring/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    load()
  }

  if (items.length === 0) return <p className="text-gray-500 text-sm text-center py-4">정기 투자가 없습니다.</p>

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0">
          <div className="flex-1">
            <p className="text-white text-sm font-medium">{item.ticker}</p>
            <p className="text-xs text-gray-400">
              ${item.amount} · {FREQ_LABEL[item.frequency]}
              {item.lastRun && ` · 최근: ${item.lastRun.slice(0, 10)}`}
            </p>
          </div>
          <button
            onClick={() => toggle(item.id, item.active)}
            className={`text-xs px-2 py-1 rounded-full ${
              item.active ? 'bg-green-950 text-green-400' : 'bg-gray-800 text-gray-500'
            }`}
          >
            {item.active ? '활성' : '비활성'}
          </button>
          <button onClick={() => remove(item.id)} className="text-gray-500 hover:text-red-400 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
