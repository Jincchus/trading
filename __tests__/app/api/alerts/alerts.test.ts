import { GET, POST } from '@/app/api/alerts/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    alert: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'a-1', ticker: 'AAPL', targetPrice: 200, direction: 'above', active: true, createdAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue(
        { id: 'a-2', ticker: 'MSFT', targetPrice: 400, direction: 'above', active: true, createdAt: new Date() }
      ),
    },
    alertHistory: { findMany: jest.fn().mockResolvedValue([]) },
  },
}))

test('GET returns active alerts', async () => {
  const res = await GET(new NextRequest('http://localhost/api/alerts'))
  const data = await res.json()
  expect(data.alerts).toHaveLength(1)
  expect(data.alerts[0].ticker).toBe('AAPL')
})

test('POST creates target price alert', async () => {
  const req = new NextRequest('http://localhost/api/alerts', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'MSFT', targetPrice: 400, direction: 'above' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  expect((await res.json()).alert.ticker).toBe('MSFT')
})

test('POST returns 400 for invalid direction', async () => {
  const req = new NextRequest('http://localhost/api/alerts', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'AAPL', targetPrice: 200, direction: 'sideways' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
