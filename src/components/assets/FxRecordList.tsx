'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface FxRecord {
  id: string
  date: string
  krwAmount: number
  usdAmount: number
  exchangeRate: number
  source: string
}

interface Props {
  refreshKey?: number
}

export default function FxRecordList({ refreshKey }: Props) {
  const [records, setRecords] = useState<FxRecord[]>([])

  const load = () =>
    fetch('/api/fx-records').then((r) => r.json()).then((d) => setRecords(d.records ?? []))

  useEffect(() => { load() }, [refreshKey])

  const remove = async (id: string) => {
    await fetch(`/api/fx-records/${id}`, { method: 'DELETE' })
    load()
  }

  if (records.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">환전 기록이 없습니다.</p>
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
          <div>
            <p className="text-white text-sm">
              {r.krwAmount.toLocaleString()}원 → ${r.usdAmount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">
              {r.date.slice(0, 10)} · {r.exchangeRate.toFixed(0)}원/$ · {r.source === 'wise' ? 'Wise' : '수동'}
            </p>
          </div>
          <button onClick={() => remove(r.id)} className="text-gray-500 hover:text-red-400 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
