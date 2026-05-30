import { GET } from '@/app/api/exchange-rate/route'

jest.mock('@/lib/exchange-rate', () => ({
  getCurrentKrwRate: jest.fn().mockResolvedValue(1320.5),
}))

test('GET returns current KRW/USD rate', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.rate).toBe(1320.5)
  expect(data.base).toBe('USD')
  expect(data.target).toBe('KRW')
})
