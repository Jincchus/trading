import { POST } from '@/app/api/orders/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    placeOrder: jest.fn(),
    getOrders: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    taxRecord: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}))

jest.mock('@/lib/exchange-rate', () => ({
  getCurrentKrwRate: jest.fn().mockResolvedValue(1300),
}))

function makePostReq(body: object) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockReset()
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.create.mockClear()
})

test('POST places market buy order', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-1', symbol: 'AAPL', side: 'buy', status: 'pending_new',
    qty: '10', filled_qty: '0', filled_avg_price: null, filled_at: null,
    type: 'market', extended_hours: false,
  })
  const res = await POST(makePostReq({ ticker: 'AAPL', side: 'buy', type: 'market', qty: 10 }))
  const data = await res.json()
  expect(res.status).toBe(201)
  expect(data.order.symbol).toBe('AAPL')
  expect(alpaca.placeOrder).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL', side: 'buy', type: 'market' }))
})

test('POST creates Lot when market buy fills immediately', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-2', symbol: 'MSFT', side: 'buy', status: 'filled',
    qty: '5', filled_qty: '5', filled_avg_price: '380.00', filled_at: '2024-01-15T14:30:00Z',
    type: 'market', extended_hours: false,
  })
  const { prisma } = jest.requireMock('@/lib/db')
  await POST(makePostReq({ ticker: 'MSFT', side: 'buy', type: 'market', qty: 5 }))
  expect(prisma.lot.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ ticker: 'MSFT', quantity: 5, purchasePrice: 380 }),
  }))
})

test('POST updates Lot soldQuantity when sell fills', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-3', symbol: 'AAPL', side: 'sell', status: 'filled',
    qty: '3', filled_qty: '3', filled_avg_price: '175.00', filled_at: '2024-01-15T14:30:00Z',
    type: 'market', extended_hours: false,
  })
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findUnique.mockResolvedValue({ id: 'lot-1', ticker: 'AAPL', quantity: 10, soldQuantity: 0, status: 'active', purchasePrice: 150, purchaseDate: new Date('2024-01-01') })
  await POST(makePostReq({ ticker: 'AAPL', side: 'sell', type: 'market', qty: 3, lotId: 'lot-1' }))
  expect(prisma.lot.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'lot-1' },
    data: expect.objectContaining({ soldQuantity: 3, status: 'active' }),
  }))
  const { prisma: p } = jest.requireMock('@/lib/db')
  expect(p.taxRecord.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ ticker: 'AAPL', quantity: 3, lotId: 'lot-1' }),
    })
  )
})

test('POST returns 502 on Alpaca error', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockRejectedValue(new Error('Insufficient funds'))
  const res = await POST(makePostReq({ ticker: 'AAPL', side: 'buy', type: 'market', qty: 1 }))
  expect(res.status).toBe(502)
})
