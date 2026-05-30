import { GET } from '@/app/api/portfolio/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getPositions: jest.fn().mockResolvedValue([
      {
        symbol: 'AAPL',
        qty: '10',
        current_price: '175.00',
        unrealized_pl: '250.00',
        unrealized_plpc: '0.1667',
        avg_entry_price: '150.00',
      },
    ]),
  },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'lot-1',
          ticker: 'AAPL',
          quantity: 10,
          soldQuantity: 0,
          purchasePrice: 150,
          purchaseDate: new Date('2024-01-15'),
          status: 'active',
          strategyId: null,
        },
      ]),
    },
    stockCategory: {
      findMany: jest.fn().mockResolvedValue([
        {
          ticker: 'AAPL',
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'AI', color: '#3b82f6' },
        },
      ]),
    },
  },
}))

test('GET returns enriched portfolio positions', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.positions).toHaveLength(1)
  expect(data.positions[0].ticker).toBe('AAPL')
  expect(data.positions[0].currentPrice).toBe(175)
  expect(data.positions[0].categories).toContain('AI')
})

test('GET calculates lot-level P&L correctly', async () => {
  const res = await GET()
  const data = await res.json()
  const lot = data.positions[0].lots[0]
  expect(lot.unrealizedPL).toBeCloseTo(250, 1)
  expect(lot.unrealizedPLPct).toBeCloseTo(16.67, 1)
})

test('GET calculates total portfolio value', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.totalValue).toBeCloseTo(1750, 0)
})
