'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function FxRecordForm({ onSuccess }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [krwAmount, setKrwAmount] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!krwAmount || !usdAmount) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/fx-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, krwAmount: parseFloat(krwAmount), usdAmount: parseFloat(usdAmount) }),
      })
      if (res.ok) {
        setKrwAmount('')
        setUsdAmount('')
        onSuccess?.()
      } else {
        const d = await res.json()
        setError(d.error ?? '추가 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setSubmitting(false)
    }
  }

  const rate = krwAmount && usdAmount
    ? (parseFloat(krwAmount) / parseFloat(usdAmount)).toFixed(0)
    : null

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">환전 기록 추가</h3>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <input
          type="number"
          value={krwAmount}
          onChange={(e) => setKrwAmount(e.target.value)}
          placeholder="원화 금액 (예: 1300000)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
        <input
          type="number"
          value={usdAmount}
          onChange={(e) => setUsdAmount(e.target.value)}
          placeholder="달러 수령액 (예: 1000)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
      </div>
      {rate && <p className="text-xs text-gray-400">환율: {rate}원/$</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting || !krwAmount || !usdAmount}
        className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl disabled:opacity-40 font-medium"
      >
        {submitting ? '추가 중...' : '환전 기록 추가'}
      </button>
    </div>
  )
}
