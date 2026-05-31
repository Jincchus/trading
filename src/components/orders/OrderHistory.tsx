'use client'

import { useEffect, useState, useCallback } from 'react'

interface AlpacaOrder {
  id: string
  symbol: string
  side: string
  status: string
  qty: string
  filled_qty: string
  type: string
  filled_avg_price: string | null
  filled_at: string | null
  extended_hours: boolean
}

type Filter = 'all' | 'filled' | 'open'

const STATUS_LABEL: Record<string, string> = {
  filled: '체결', partially_filled: '부분체결',
  pending_new: '대기', new: '접수', canceled: '취소', expired: '만료',
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<AlpacaOrder[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const status = filter === 'open' ? 'open' : filter === 'filled' ? 'closed' : 'all'
    fetch(`/api/orders?status=${status}`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const cancel = async (orderId: string) => {
    await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
    load()
  }

  const isOpen = (status: string) =>
    ['pending_new', 'new', 'partially_filled', 'accepted'].includes(status)

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="flex border-b border-gray-800">
        {(['all', 'filled', 'open'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              filter === f ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'
            }`}
          >
            {f === 'all' ? '전체' : f === 'filled' ? '체결' : '미체결'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse h-32 bg-gray-800" />
      ) : orders.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">주문 내역이 없습니다.</p>
      ) : (
        <div>
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white text-sm">{order.symbol}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    order.side === 'buy' ? 'bg-red-950 text-red-400' : 'bg-blue-950 text-blue-400'
                  }`}>
                    {order.side === 'buy' ? '매수' : '매도'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.type === 'market' ? '시장가' : '지정가'} · {order.qty}주
                  {order.filled_avg_price && ` · $${parseFloat(order.filled_avg_price).toFixed(2)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{STATUS_LABEL[order.status] ?? order.status}</span>
                {isOpen(order.status) && (
                  <button
                    onClick={() => cancel(order.id)}
                    className="text-[10px] text-red-400 border border-red-900 px-2 py-0.5 rounded"
                  >
                    취소
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
