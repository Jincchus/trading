import { DELETE } from '@/app/api/orders/[orderId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: { cancelOrder: jest.fn().mockResolvedValue(undefined) },
}))

test('DELETE cancels order', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ orderId: 'order-1' }) })
  const data = await res.json()
  expect(data.ok).toBe(true)
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  expect(alpaca.cancelOrder).toHaveBeenCalledWith('order-1')
})

test('DELETE returns 502 on error', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.cancelOrder.mockRejectedValueOnce(new Error('Already filled'))
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ orderId: 'bad' }) })
  expect(res.status).toBe(502)
})
