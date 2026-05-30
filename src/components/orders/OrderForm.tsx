'use client'

import { useState } from 'react'

interface Props {
  defaultTicker?: string
  onSuccess?: () => void
}

type OrderType = 'market' | 'limit'
type InputMode = 'qty' | 'notional'

export default function OrderForm({ defaultTicker = '', onSuccess }: Props) {
  const [ticker, setTicker] = useState(defaultTicker)
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [inputMode, setInputMode] = useState<InputMode>('notional')
  const [value, setValue] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [extendedHours, setExtendedHours] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const submit = async () => {
    if (!ticker.trim() || !value) return
    setSubmitting(true)
    setResult(null)

    const body: Record<string, unknown> = {
      ticker: ticker.trim().toUpperCase(),
      side: 'buy',
      type: orderType,
      ...(inputMode === 'qty' ? { qty: parseFloat(value) } : { notional: parseFloat(value) }),
      ...(orderType === 'limit' && limitPrice && { limitPrice: parseFloat(limitPrice) }),
      ...(extendedHours && { extendedHours: true }),
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `주문 완료: ${data.order.status}` })
        setValue('')
        setLimitPrice('')
        onSuccess?.()
      } else {
        setResult({ ok: false, message: data.error ?? '주문 실패' })
      }
    } catch {
      setResult({ ok: false, message: '네트워크 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">매수 주문</h3>

      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="종목 티커 (예: AAPL)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      <div className="flex gap-2">
        {(['market', 'limit'] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
              orderType === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {t === 'market' ? '시장가' : '지정가'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(['notional', 'qty'] as InputMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setInputMode(m)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
              inputMode === m ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {m === 'notional' ? 'USD 금액' : '주 수량'}
          </button>
        ))}
      </div>

      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={inputMode === 'notional' ? 'USD 금액 (예: 100)' : '수량 (예: 0.5)'}
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      {orderType === 'limit' && (
        <input
          type="number"
          value={limitPrice}
          onChange={(e) => setLimitPrice(e.target.value)}
          placeholder="지정가 (USD)"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
      )}

      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={extendedHours}
          onChange={(e) => setExtendedHours(e.target.checked)}
          className="accent-blue-500"
        />
        프리/애프터마켓
      </label>

      {result && (
        <p className={`text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
          {result.message}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting || !ticker.trim() || !value}
        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
      >
        {submitting ? '주문 중...' : '매수'}
      </button>
    </div>
  )
}
