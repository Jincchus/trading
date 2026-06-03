import { runRecurringInvestments } from '@/lib/recurring-runner'

jest.mock('@/lib/db', () => ({
  prisma: {
    recurringInvestment: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    orderAudit: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    lot: {
      create: jest.fn().mockResolvedValue({}),
    },
    tradingSettings: {
      upsert: jest.fn().mockResolvedValue({ id: 1, tradingEnabled: true }),
    },
  },
}))

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: { placeOrder: jest.fn() },
}))

function mocks() {
  return {
    prisma: jest.requireMock('@/lib/db').prisma,
    alpaca: jest.requireMock('@/lib/alpaca/client').alpaca,
  }
}

const OLD = new Date('2020-01-01T00:00:00Z') // far in the past → daily is due

beforeEach(() => {
  const { prisma, alpaca } = mocks()
  prisma.recurringInvestment.findMany.mockReset()
  prisma.recurringInvestment.update.mockClear()
  prisma.orderAudit.create.mockClear()
  prisma.orderAudit.update.mockClear()
  prisma.lot.create.mockClear()
  prisma.tradingSettings.upsert.mockResolvedValue({ id: 1, tradingEnabled: true })
  alpaca.placeOrder.mockReset()
})

test('does nothing when trading is disabled', async () => {
  const { prisma, alpaca } = mocks()
  prisma.tradingSettings.upsert.mockResolvedValue({ id: 1, tradingEnabled: false })
  prisma.recurringInvestment.findMany.mockResolvedValue([
    { id: 'ri-1', ticker: 'VOO', amount: 100, frequency: 'daily', active: true, lastRun: OLD },
  ])
  await runRecurringInvestments(new Date())
  expect(alpaca.placeOrder).not.toHaveBeenCalled()
})

test('skips investments that are not due', async () => {
  const { prisma, alpaca } = mocks()
  prisma.recurringInvestment.findMany.mockResolvedValue([
    { id: 'ri-1', ticker: 'VOO', amount: 100, frequency: 'daily', active: true, lastRun: new Date() },
  ])
  await runRecurringInvestments(new Date())
  expect(alpaca.placeOrder).not.toHaveBeenCalled()
})

test('places a notional buy with a client_order_id and records an audit', async () => {
  const { prisma, alpaca } = mocks()
  prisma.recurringInvestment.findMany.mockResolvedValue([
    { id: 'ri-1', ticker: 'voo', amount: 100, frequency: 'daily', active: true, lastRun: OLD },
  ])
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-1', symbol: 'VOO', side: 'buy', status: 'pending_new',
    qty: '', filled_qty: '0', filled_avg_price: null, filled_at: null, type: 'market', extended_hours: false,
  })
  const now = new Date()
  await runRecurringInvestments(now)

  expect(alpaca.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
    symbol: 'VOO', notional: '100', side: 'buy', type: 'market',
    client_order_id: expect.any(String),
  }))
  expect(prisma.orderAudit.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ source: 'recurring', ticker: 'VOO', side: 'buy' }),
  }))
  expect(prisma.recurringInvestment.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'ri-1' }, data: { lastRun: now },
  }))
})

test('creates a Lot when the buy fills immediately', async () => {
  const { prisma, alpaca } = mocks()
  prisma.recurringInvestment.findMany.mockResolvedValue([
    { id: 'ri-1', ticker: 'VOO', amount: 100, frequency: 'daily', active: true, lastRun: OLD },
  ])
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-2', symbol: 'VOO', side: 'buy', status: 'filled',
    qty: '0.25', filled_qty: '0.25', filled_avg_price: '400', filled_at: '2024-01-15T14:30:00Z',
    type: 'market', extended_hours: false,
  })
  await runRecurringInvestments(new Date())
  expect(prisma.lot.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ ticker: 'VOO', quantity: 0.25, purchasePrice: 400, alpacaOrderId: 'order-2' }),
  }))
})

test('rolls back lastRun when the order fails', async () => {
  const { prisma, alpaca } = mocks()
  prisma.recurringInvestment.findMany.mockResolvedValue([
    { id: 'ri-1', ticker: 'VOO', amount: 100, frequency: 'daily', active: true, lastRun: OLD },
  ])
  alpaca.placeOrder.mockRejectedValue(new Error('Insufficient buying power'))
  await runRecurringInvestments(new Date())
  // last update call must restore the previous lastRun (OLD), not leave it advanced
  const calls = prisma.recurringInvestment.update.mock.calls
  expect(calls[calls.length - 1][0]).toEqual(expect.objectContaining({
    where: { id: 'ri-1' }, data: { lastRun: OLD },
  }))
  expect(prisma.lot.create).not.toHaveBeenCalled()
})
