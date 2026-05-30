import { PUT, DELETE } from '@/app/api/recurring/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    recurringInvestment: {
      update: jest.fn().mockResolvedValue(
        { id: 'ri-1', ticker: 'AAPL', amount: 200, frequency: 'weekly', active: false, lastRun: null, createdAt: new Date() }
      ),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('PUT updates recurring investment', async () => {
  const req = new NextRequest('http://localhost/api/recurring/ri-1', {
    method: 'PUT',
    body: JSON.stringify({ amount: 200, active: false }),
  })
  const res = await PUT(req, { params: Promise.resolve({ id: 'ri-1' }) })
  const data = await res.json()
  expect(data.recurring.amount).toBe(200)
})

test('DELETE removes recurring investment', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'ri-1' }) })
  const data = await res.json()
  expect(data.ok).toBe(true)
})
