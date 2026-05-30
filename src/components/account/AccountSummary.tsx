'use client'

import { useEffect, useState } from 'react'
import type { AlpacaAccount } from '@/lib/alpaca/client'

export default function AccountSummary() {
  const [account, setAccount] = useState<AlpacaAccount | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/account')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setAccount)
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="text-red-400 text-sm p-4">계좌 정보를 불러올 수 없습니다</p>
  if (!account) return <div className="bg-gray-900 rounded-xl p-4 animate-pulse h-24" />

  const fmt = (val: string) =>
    parseFloat(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">총 자산</p>
      <p className="text-2xl font-bold">{fmt(account.equity)}</p>
      <div className="flex gap-6 mt-3">
        <div>
          <p className="text-gray-400 text-xs">주문 가능</p>
          <p className="text-sm">{fmt(account.buying_power)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">현금</p>
          <p className="text-sm">{fmt(account.cash)}</p>
        </div>
      </div>
    </div>
  )
}
