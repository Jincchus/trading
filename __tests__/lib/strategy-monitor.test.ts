import { checkStrategies } from '@/lib/strategy-monitor'

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    tradingSettings: {
      upsert: jest.fn().mockResolvedValue({ id: 1, tradingEnabled: true }),
    },
  },
}))

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getClock: jest.fn(),
    getPositions: jest.fn(),
    getOrders: jest.fn(),
    placeOrder: jest.fn(),
  },
}))

jest.mock('@/lib/push', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  const { prisma } = jest.requireMock('@/lib/db')
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  prisma.lot.findMany.mockReset()
  prisma.lot.update.mockClear()
  alpaca.placeOrder.mockReset()
  alpaca.getPositions.mockReset()
  alpaca.getClock.mockResolvedValue({ is_open: true, next_open: '', next_close: '' })
  alpaca.getOrders.mockResolvedValue([])
  // freshLot re-read mirrors whatever the most recent findMany returned.
  prisma.lot.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const result = prisma.lot.findMany.mock.results[0]
    const lots = result ? await result.value : []
    return lots.find((l: { id: string }) => l.id === where.id) ?? null
  })
})

test('no-op when no lots have strategies', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await checkStrategies()
  expect(alpaca.getPositions).not.toHaveBeenCalled()
})

test('executes sell when P&L exceeds threshold', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 100, purchasePrice: 150,
    soldQuantity: 0, status: 'active',
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '180', qty: '100',
      avg_entry_price: '150', unrealized_pl: '3000', unrealized_plpc: '0.2' },
  ])
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-1', symbol: 'AAPL', side: 'sell', status: 'filled',
    qty: '30', filled_qty: '30', filled_avg_price: '180', filled_at: '2024-01-15T14:30:00Z',
    type: 'market', extended_hours: false,
  })

  await checkStrategies()

  expect(alpaca.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
    symbol: 'AAPL', side: 'sell', qty: '30',
  }))
  expect(prisma.lot.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'lot-1' },
    data: expect.objectContaining({ soldQuantity: 30, status: 'active' }),
  }))
})

test('does not sell when P&L below threshold', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 100, purchasePrice: 150,
    soldQuantity: 0, status: 'active',
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '160', qty: '100',
      avg_entry_price: '150', unrealized_pl: '1000', unrealized_plpc: '0.0667' },
  ])
  await checkStrategies()
  expect(alpaca.placeOrder).not.toHaveBeenCalled()
})

test('skips rule if soldQuantity already meets target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 100, purchasePrice: 150,
    soldQuantity: 30, status: 'active',
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '180', qty: '70',
      avg_entry_price: '150', unrealized_pl: '2100', unrealized_plpc: '0.2' },
  ])
  await checkStrategies()
  expect(alpaca.placeOrder).not.toHaveBeenCalled()
})

test('marks lot fully_sold when all shares sold', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 10, purchasePrice: 150,
    soldQuantity: 0, status: 'active',
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 100 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '180', qty: '10',
      avg_entry_price: '150', unrealized_pl: '300', unrealized_plpc: '0.2' },
  ])
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-1', symbol: 'AAPL', side: 'sell', status: 'filled',
    qty: '10', filled_qty: '10', filled_avg_price: '180', filled_at: '2024-01-15T14:30:00Z',
    type: 'market', extended_hours: false,
  })
  await checkStrategies()
  expect(prisma.lot.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ soldQuantity: 10, status: 'fully_sold' }),
  }))
})
