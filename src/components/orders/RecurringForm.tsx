'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function RecurringForm({ onSuccess }: Props) {
  const [ticker, setTicker] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!ticker.trim() || !amount) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), amount: parseFloat(amount), frequency }),
      })
      if (res.ok) {
        setTicker('')
        setAmount('')
        onSuccess?.()
      } else {
        const d = await res.json()
        setError(d.error ?? '생성 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">정기 투자 추가</h3>
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="종목 티커 (예: AAPL)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="USD 금액 (예: 100)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFrequency(f)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
              frequency === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {f === 'daily' ? '매일' : f === 'weekly' ? '매주' : '매월'}
          </button>
        ))}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting || !ticker.trim() || !amount}
        className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl disabled:opacity-40 font-medium"
      >
        {submitting ? '추가 중...' : '정기 투자 추가'}
      </button>
    </div>
  )
}
