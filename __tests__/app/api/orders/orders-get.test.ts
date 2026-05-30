import { GET } from '@/app/api/orders/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({ prisma: { lot: {} } }))

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getOrders: jest.fn().mockResolvedValue([
      { id: 'o-1', symbol: 'AAPL', side: 'buy', status: 'filled', qty: '10', filled_qty: '10', type: 'market', filled_avg_price: '150.00', filled_at: '2024-01-15T14:30:00Z', extended_hours: false },
      { id: 'o-2', symbol: 'MSFT', side: 'buy', status: 'pending_new', qty: '5', filled_qty: '0', type: 'limit', filled_avg_price: null, filled_at: null, extended_hours: false },
    ]),
  },
}))

function makeGetReq(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/orders')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

test('GET returns all recent orders', async () => {
  const res = await GET(makeGetReq())
  const data = await res.json()
  expect(data.orders).toHaveLength(2)
})

test('GET passes status filter to Alpaca', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await GET(makeGetReq({ status: 'open' }))
  expect(alpaca.getOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }))
})
