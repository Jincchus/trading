import { GET } from '@/app/api/account/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getAccount: jest.fn().mockResolvedValue({
      buying_power: '10000.00',
      cash: '5000.00',
      portfolio_value: '15000.00',
      equity: '15000.00',
    }),
  },
}))

test('GET /api/account returns account data', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.equity).toBe('15000.00')
  expect(data.buying_power).toBe('10000.00')
})
