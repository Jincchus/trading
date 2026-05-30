import { GET, POST } from '@/app/api/recurring/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    recurringInvestment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'ri-1', ticker: 'AAPL', amount: 100, frequency: 'weekly', active: true, lastRun: null, createdAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue(
        { id: 'ri-2', ticker: 'MSFT', amount: 50, frequency: 'monthly', active: true, lastRun: null, createdAt: new Date() }
      ),
    },
  },
}))

test('GET returns recurring investments', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.recurring).toHaveLength(1)
  expect(data.recurring[0].ticker).toBe('AAPL')
})

test('POST creates recurring investment', async () => {
  const req = new NextRequest('http://localhost/api/recurring', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'MSFT', amount: 50, frequency: 'monthly' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.recurring.ticker).toBe('MSFT')
})

test('POST returns 400 for invalid frequency', async () => {
  const req = new NextRequest('http://localhost/api/recurring', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'AAPL', amount: 100, frequency: 'hourly' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
