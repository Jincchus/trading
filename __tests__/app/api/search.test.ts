import { GET } from '@/app/api/search/route'
import { NextRequest } from 'next/server'

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      { symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD', stockExchange: 'NASDAQ', exchangeShortName: 'NASDAQ' },
      { symbol: 'AAPLX', name: 'Apple Fund', currency: 'USD', stockExchange: 'MUTUAL_FUND', exchangeShortName: 'MUTUAL_FUND' },
    ]),
  } as Response)
})

test('GET filters to stock exchanges only', async () => {
  const res = await GET(new NextRequest('http://localhost/api/search?q=AAPL'))
  const data = await res.json()
  expect(data.results.every((r: { type: string }) => r.type === 'stock')).toBe(true)
  expect(data.results.find((r: { symbol: string }) => r.symbol === 'AAPLX')).toBeUndefined()
})

test('GET returns 400 when query is empty', async () => {
  const res = await GET(new NextRequest('http://localhost/api/search'))
  expect(res.status).toBe(400)
})

test('GET returns empty array on FMP error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 } as Response)
  const res = await GET(new NextRequest('http://localhost/api/search?q=AAPL'))
  expect((await res.json()).results).toHaveLength(0)
})
