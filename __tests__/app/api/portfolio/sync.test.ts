import { POST } from '@/app/api/portfolio/sync/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getOrders: jest.fn().mockResolvedValue([
      {
        id: 'order-1',
        symbol: 'AAPL',
        qty: '10',
        filled_qty: '10',
        filled_avg_price: '150.00',
        filled_at: '2024-01-15T14:30:00Z',
        side: 'buy',
        status: 'filled',
        type: 'market',
        extended_hours: false,
      },
      {
        id: 'order-2',
        symbol: 'MSFT',
        qty: '5',
        filled_qty: '5',
        filled_avg_price: '380.00',
        filled_at: '2024-01-16T14:30:00Z',
        side: 'buy',
        status: 'filled',
        type: 'market',
        extended_hours: false,
      },
      {
        id: 'order-3',
        symbol: 'AAPL',
        qty: '5',
        filled_qty: '5',
        filled_avg_price: '175.00',
        filled_at: '2024-01-20T14:30:00Z',
        side: 'sell',
        status: 'filled',
        type: 'market',
        extended_hours: false,
      },
    ]),
  },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('POST syncs only filled buy orders (excludes sell)', async () => {
  const res = await POST()
  const data = await res.json()
  expect(data.synced).toBe(2)
})

test('POST upserts with correct lot data', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.upsert.mockClear()
  await POST()
  expect(prisma.lot.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { alpacaOrderId: 'order-1' },
      create: expect.objectContaining({
        ticker: 'AAPL',
        quantity: 10,
        purchasePrice: 150,
      }),
    })
  )
})

test('POST returns 502 on Alpaca error', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getOrders.mockRejectedValueOnce(new Error('Network error'))
  const res = await POST()
  expect(res.status).toBe(502)
})
