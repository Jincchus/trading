import { checkAlerts } from '@/lib/alert-monitor'

jest.mock('@/lib/db', () => ({
  prisma: {
    alert: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    alertHistory: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}))

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: { getPositions: jest.fn() },
}))

jest.mock('@/lib/push', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
}))

beforeEach(() => { jest.clearAllMocks() })

test('no-op when no active alerts', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await checkAlerts()
  expect(alpaca.getPositions).not.toHaveBeenCalled()
})

test('fires push when price is above target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([
    { id: 'a-1', ticker: 'AAPL', targetPrice: 180, direction: 'above', active: true },
  ])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '185', qty: '10', avg_entry_price: '150', unrealized_pl: '350', unrealized_plpc: '0.233' },
  ])
  await checkAlerts()
  const { sendPushNotification } = jest.requireMock('@/lib/push')
  expect(sendPushNotification).toHaveBeenCalledWith('AAPL 목표가 도달', expect.stringContaining('185'))
})

test('does not fire when price below above-target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([
    { id: 'a-1', ticker: 'AAPL', targetPrice: 200, direction: 'above', active: true },
  ])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '175', qty: '10', avg_entry_price: '150', unrealized_pl: '250', unrealized_plpc: '0.166' },
  ])
  await checkAlerts()
  const { sendPushNotification } = jest.requireMock('@/lib/push')
  expect(sendPushNotification).not.toHaveBeenCalled()
})

test('fires push when price below below-target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([
    { id: 'a-1', ticker: 'AAPL', targetPrice: 140, direction: 'below', active: true },
  ])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '135', qty: '10', avg_entry_price: '150', unrealized_pl: '-150', unrealized_plpc: '-0.1' },
  ])
  await checkAlerts()
  const { sendPushNotification } = jest.requireMock('@/lib/push')
  expect(sendPushNotification).toHaveBeenCalled()
})
