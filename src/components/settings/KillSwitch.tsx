'use client'

import { useEffect, useState } from 'react'
import { ShieldOff, ShieldCheck } from 'lucide-react'

export default function KillSwitch() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/trading-settings')
      .then((r) => r.json() as Promise<{ tradingEnabled: boolean }>)
      .then((d) => setEnabled(d.tradingEnabled))
      .catch(() => {})
  }, [])

  const toggle = async () => {
    const next = !enabled
    const confirm = next
      ? '자동매매를 재개할까요?'
      : '⚠️ 자동매매를 정지하고 미체결 주문을 전량 취소할까요?'
    if (!window.confirm(confirm)) return
    setLoading(true)
    try {
      const res = await fetch('/api/trading-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingEnabled: next }),
      })
      if (res.ok) setEnabled(next)
      else alert('처리 실패')
    } finally {
      setLoading(false)
    }
  }

  if (enabled === null) return null

  return (
    <div className={`rounded-xl p-4 ${enabled ? 'bg-gray-900' : 'bg-red-950 border border-red-800'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled
            ? <ShieldCheck size={18} className="text-emerald-400" />
            : <ShieldOff size={18} className="text-red-400" />}
          <div>
            <p className={`text-sm font-semibold ${enabled ? 'text-gray-200' : 'text-red-300'}`}>
              {enabled ? '자동매매 활성' : '자동매매 정지됨'}
            </p>
            <p className="text-gray-500 text-xs">
              {enabled ? '전략·정기투자 자동 실행 중' : '모든 자동 주문 차단됨'}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold disabled:opacity-50 ${
            enabled
              ? 'bg-red-950 text-red-400 hover:bg-red-900'
              : 'bg-emerald-900 text-emerald-400 hover:bg-emerald-800'
          }`}
        >
          {loading ? '처리 중...' : enabled ? '정지' : '재개'}
        </button>
      </div>
    </div>
  )
}
