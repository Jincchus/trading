'use client'

import { useEffect, useState } from 'react'

interface Strategy {
  id: string
  name: string
}

interface Props {
  lotId: string
  currentStrategyId: string | null
}

export default function LotStrategyBadge({ lotId, currentStrategyId }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [selectedId, setSelectedId] = useState<string>(currentStrategyId ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/strategies')
      .then((r) => r.json())
      .then((d) => setStrategies(d.strategies ?? []))
  }, [])

  useEffect(() => {
    setSelectedId(currentStrategyId ?? '')
  }, [currentStrategyId])

  const assign = async (strategyId: string | null) => {
    setSaving(true)
    try {
      await fetch(`/api/lots/${lotId}/strategy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      })
      setSelectedId(strategyId ?? '')
    } finally {
      setSaving(false)
    }
  }

  if (strategies.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] text-gray-500">전략</span>
      <select
        value={selectedId}
        onChange={(e) => assign(e.target.value || null)}
        disabled={saving}
        className="text-[10px] bg-transparent text-blue-400 outline-none cursor-pointer border-0"
      >
        <option value="">없음</option>
        {strategies.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  )
}
