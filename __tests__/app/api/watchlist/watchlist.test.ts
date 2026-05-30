import { GET, POST } from '@/app/api/watchlist/route'
import { DELETE } from '@/app/api/watchlist/[ticker]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    watchlist: {
      findMany: jest.fn().mockResolvedValue([
        { ticker: 'AAPL', addedAt: new Date() },
        { ticker: 'MSFT', addedAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue({ ticker: 'NVDA', addedAt: new Date() }),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('GET returns watchlist tickers', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.tickers).toHaveLength(2)
  expect(data.tickers[0]).toBe('AAPL')
})

test('POST adds ticker to watchlist', async () => {
  const req = new NextRequest('http://localhost/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'NVDA' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  expect((await res.json()).ticker).toBe('NVDA')
})

test('POST returns 400 for missing ticker', async () => {
  const req = new NextRequest('http://localhost/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})

test('DELETE removes ticker from watchlist', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ ticker: 'AAPL' }),
  })
  expect((await res.json()).ok).toBe(true)
})
