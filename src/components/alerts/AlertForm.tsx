'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function AlertForm({ onSuccess }: Props) {
  const [ticker, setTicker] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!ticker.trim() || !targetPrice) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), targetPrice: parseFloat(targetPrice), direction }),
      })
      if (res.ok) { setTicker(''); setTargetPrice(''); onSuccess?.() }
      else { const d = await res.json(); setError(d.error ?? '생성 실패') }
    } catch { setError('네트워크 오류') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">목표가 알림 설정</h3>
      <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="종목 티커 (예: AAPL)" className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500" />
      <div className="flex gap-2">
        <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="목표 가격 (USD)" className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500" />
        <div className="flex rounded-lg overflow-hidden">
          {(['above', 'below'] as const).map((d) => (
            <button key={d} onClick={() => setDirection(d)} className={`px-3 py-2 text-xs font-medium ${direction === d ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {d === 'above' ? '이상' : '이하'}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={submit} disabled={submitting || !ticker.trim() || !targetPrice} className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl disabled:opacity-40 font-medium">
        {submitting ? '추가 중...' : '알림 추가'}
      </button>
    </div>
  )
}
