import { GET } from '@/app/api/stocks/[ticker]/bars/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getBars: jest.fn().mockResolvedValue({
      bars: [
        { t: '2024-01-15T09:30:00Z', o: 150, h: 155, l: 148, c: 152, v: 1000000 },
        { t: '2024-01-16T09:30:00Z', o: 152, h: 158, l: 150, c: 156, v: 1200000 },
      ],
    }),
  },
}))

function makeRequest(ticker: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/stocks/${ticker}/bars`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

test('GET returns bars for ticker', async () => {
  const res = await GET(makeRequest('AAPL'), { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.bars).toHaveLength(2)
  expect(data.bars[0].c).toBe(152)
})

test('GET passes timeframe param to Alpaca client', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await GET(makeRequest('AAPL', { timeframe: '1Hour' }), { params: Promise.resolve({ ticker: 'AAPL' }) })
  expect(alpaca.getBars).toHaveBeenCalledWith('AAPL', expect.objectContaining({ timeframe: '1Hour' }))
})

test('GET returns 400 for invalid timeframe', async () => {
  const res = await GET(makeRequest('AAPL', { timeframe: 'invalid' }), { params: Promise.resolve({ ticker: 'AAPL' }) })
  expect(res.status).toBe(400)
})
