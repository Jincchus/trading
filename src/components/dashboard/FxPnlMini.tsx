'use client'

import { useEffect, useState } from 'react'

interface FxRecord { krwAmount: number }

export default function FxPnlMini() {
  const [invested, setInvested] = useState<number | null>(null)
  const [krwValue, setKrwValue] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/fx-records').then((r) => r.json()),
      fetch('/api/exchange-rate').then((r) => r.json()),
      fetch('/api/account').then((r) => r.json()),
    ])
      .then(([fxData, rateData, accountData]) => {
        const inv = (fxData.records as FxRecord[]).reduce((s, r) => s + r.krwAmount, 0)
        const equity = parseFloat(accountData.equity ?? '0')
        setInvested(inv)
        setKrwValue(equity * (rateData.rate ?? 1300))
      })
      .catch(() => {})
  }, [])

  if (invested === null || krwValue === null || invested === 0) return null

  const pnl = krwValue - invested
  const isUp = pnl >= 0
  const fmt = (v: number) => v.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' })

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-xs">환차익/손실</p>
        <p className={`text-sm font-semibold mt-0.5 ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
          {isUp ? '+' : ''}{fmt(Math.round(pnl))}
        </p>
      </div>
      <div className="text-right">
        <p className="text-gray-400 text-xs">투입 원화</p>
        <p className="text-gray-300 text-sm">{fmt(Math.round(invested))}</p>
      </div>
    </div>
  )
}
