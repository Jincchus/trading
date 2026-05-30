'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import OrderForm from '@/components/orders/OrderForm'
import OrderHistory from '@/components/orders/OrderHistory'
import RecurringForm from '@/components/orders/RecurringForm'
import RecurringList from '@/components/orders/RecurringList'

type Tab = '주문' | '내역' | '정기투자'

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>('주문')
  const [recurringKey, setRecurringKey] = useState(0)

  return (
    <>
      <TopBar title="주문" />
      <div className="flex border-b border-gray-800 bg-gray-900">
        {(['주문', '내역', '정기투자'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              tab === t ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === '주문' && <OrderForm />}
        {tab === '내역' && <OrderHistory />}
        {tab === '정기투자' && (
          <>
            <RecurringForm onSuccess={() => setRecurringKey((k) => k + 1)} />
            <RecurringList refreshKey={recurringKey} />
          </>
        )}
      </div>
    </>
  )
}
