'use client'

import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'

interface StrategyRule {
  id: string
  threshold: number
  sellPct: number
}

interface Strategy {
  id: string
  name: string
  rules: StrategyRule[]
}

export default function StrategyManager() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [newName, setNewName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newThreshold, setNewThreshold] = useState('')
  const [newSellPct, setNewSellPct] = useState('')

  const load = () =>
    fetch('/api/strategies').then((r) => r.json()).then((d) => setStrategies(d.strategies ?? []))

  useEffect(() => { load() }, [])

  const createStrategy = async () => {
    if (!newName.trim()) return
    await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setNewName('')
    load()
  }

  const deleteStrategy = async (id: string) => {
    await fetch(`/api/strategies/${id}`, { method: 'DELETE' })
    if (expandedId === id) setExpandedId(null)
    load()
  }

  const addRule = async (strategyId: string) => {
    if (!newThreshold || !newSellPct) return
    const res = await fetch(`/api/strategies/${strategyId}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: parseFloat(newThreshold), sellPct: parseFloat(newSellPct) }),
    })
    if (res.ok) { setNewThreshold(''); setNewSellPct(''); load() }
  }

  const deleteRule = async (strategyId: string, ruleId: string) => {
    await fetch(`/api/strategies/${strategyId}/rules/${ruleId}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4">매매 전략 관리</h3>

      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createStrategy()}
          placeholder="전략 이름 (예: 성장주 전략)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
        <button
          onClick={createStrategy}
          disabled={!newName.trim()}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {strategies.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">전략이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {strategies.map((s) => (
            <div key={s.id} className="border border-gray-700 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-3 py-2.5 cursor-pointer bg-gray-800"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <p className="text-white text-sm font-medium">{s.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{s.rules.length}개 룰</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteStrategy(s.id) }}
                    className="text-gray-500 hover:text-red-400 p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="px-3 py-2 space-y-2">
                  {s.rules.length === 0 && (
                    <p className="text-gray-600 text-xs">룰이 없습니다.</p>
                  )}
                  {s.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">
                        {rule.threshold >= 0 ? '+' : ''}{rule.threshold}% 달성 시 → {rule.sellPct}% 매도
                      </span>
                      <button
                        onClick={() => deleteRule(s.id, rule.id)}
                        className="text-gray-600 hover:text-red-400 p-1"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-700">
                    <input
                      type="number"
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(e.target.value)}
                      placeholder="수익률 % (예: 20)"
                      className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-xs outline-none placeholder-gray-600"
                    />
                    <input
                      type="number"
                      value={newSellPct}
                      onChange={(e) => setNewSellPct(e.target.value)}
                      placeholder="매도 % (예: 30)"
                      className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-xs outline-none placeholder-gray-600"
                    />
                    <button
                      onClick={() => addRule(s.id)}
                      disabled={!newThreshold || !newSellPct}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-700 text-white text-xs rounded disabled:opacity-40"
                    >
                      <Plus size={11} /> 추가
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
