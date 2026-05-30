import { GET } from '@/app/api/stocks/[ticker]/quote/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getLatestQuote: jest.fn().mockResolvedValue({
      quote: { t: '2024-01-15T09:30:00Z', ap: 150.5, as: 100, bp: 150.0, bs: 200 },
    }),
  },
}))

test('GET returns quote for ticker', async () => {
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.quote.ap).toBe(150.5)
  expect(data.quote.bp).toBe(150.0)
})

test('GET uppercases ticker', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await GET({} as Request, { params: Promise.resolve({ ticker: 'aapl' }) })
  expect(alpaca.getLatestQuote).toHaveBeenCalledWith('AAPL')
})
