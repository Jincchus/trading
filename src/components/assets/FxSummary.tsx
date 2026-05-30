'use client'

import { useEffect, useState } from 'react'

interface FxRecord {
  krwAmount: number
}

export default function FxSummary() {
  const [totalKrwInvested, setTotalKrwInvested] = useState<number | null>(null)
  const [currentKrwValue, setCurrentKrwValue] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/fx-records').then((r) => r.json()),
      fetch('/api/exchange-rate').then((r) => r.json()),
      fetch('/api/account').then((r) => r.json()),
    ])
      .then(([fxData, rateData, accountData]) => {
        const invested = (fxData.records as FxRecord[]).reduce((s, r) => s + r.krwAmount, 0)
        const equity = parseFloat(accountData.equity ?? '0')
        const rate = rateData.rate ?? 1300
        setTotalKrwInvested(invested)
        setCurrentKrwValue(equity * rate)
      })
      .catch(() => {})
  }, [])

  const fxPnL = currentKrwValue !== null && totalKrwInvested !== null
    ? currentKrwValue - totalKrwInvested
    : null

  const fmt = (v: number) =>
    v.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' })

  if (totalKrwInvested === null) {
    return <div className="animate-pulse h-28 bg-gray-800 rounded-xl" />
  }

  const isUp = (fxPnL ?? 0) >= 0

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">환전 현황</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">총 투입 원화</p>
          <p className="text-white font-semibold">{fmt(totalKrwInvested)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">현재 KRW 환산가</p>
          <p className="text-white font-semibold">{currentKrwValue !== null ? fmt(currentKrwValue) : '-'}</p>
        </div>
        {fxPnL !== null && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-0.5">환차익/손실</p>
            <p className={`font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{fmt(fxPnL)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
