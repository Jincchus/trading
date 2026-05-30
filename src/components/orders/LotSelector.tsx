'use client'

import { useEffect, useState } from 'react'

interface LotOption {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  unrealizedPLPct: number
}

interface Props {
  ticker: string
  onSuccess?: () => void
}

export default function LotSelector({ ticker, onSuccess }: Props) {
  const [lots, setLots] = useState<LotOption[]>([])
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [qty, setQty] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data) => {
        const pos = (data.positions ?? []).find((p: { ticker: string }) => p.ticker === ticker)
        if (pos) setLots(pos.lots.filter((l: LotOption) => l.remainingQty > 0))
      })
      .catch(() => {})
  }, [ticker])

  const selectedLot = lots.find((l) => l.id === selectedLotId)

  const sell = async () => {
    if (!selectedLotId || !qty) return
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          side: 'sell',
          type: orderType,
          qty: parseFloat(qty),
          lotId: selectedLotId,
          ...(orderType === 'limit' && limitPrice && { limitPrice: parseFloat(limitPrice) }),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `매도 주문 완료: ${data.order.status}` })
        setQty('')
        setSelectedLotId('')
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

  if (lots.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-gray-400 text-sm">보유 Lot이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">{ticker} 매도</h3>

      <div className="space-y-2">
        {lots.map((lot) => {
          const isUp = lot.unrealizedPLPct >= 0
          return (
            <label
              key={lot.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border ${
                selectedLotId === lot.id ? 'border-blue-500 bg-blue-950' : 'border-gray-700 bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="lot"
                value={lot.id}
                checked={selectedLotId === lot.id}
                onChange={() => { setSelectedLotId(lot.id); setQty(String(lot.remainingQty)) }}
                className="accent-blue-500"
              />
              <div className="flex-1">
                <p className="text-xs text-gray-300">{lot.purchaseDate.slice(0, 10)}</p>
                <p className="text-xs text-gray-400">{lot.remainingQty}주 · 취득가 ${lot.purchasePrice.toFixed(2)}</p>
              </div>
              <p className={`text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{lot.unrealizedPLPct.toFixed(2)}%
              </p>
            </label>
          )
        })}
      </div>

      {selectedLot && (
        <>
          <div className="flex gap-2">
            {(['market', 'limit'] as const).map((t) => (
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

          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            max={selectedLot.remainingQty}
            placeholder={`수량 (최대 ${selectedLot.remainingQty}주)`}
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
        </>
      )}

      {result && (
        <p className={`text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}>{result.message}</p>
      )}

      <button
        onClick={sell}
        disabled={submitting || !selectedLotId || !qty}
        className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
      >
        {submitting ? '주문 중...' : '매도'}
      </button>
    </div>
  )
}
