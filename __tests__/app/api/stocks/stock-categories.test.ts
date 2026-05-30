import { GET, POST } from '@/app/api/stocks/[ticker]/categories/route'
import { DELETE } from '@/app/api/stocks/[ticker]/categories/[categoryId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    stockCategory: {
      findMany: jest.fn().mockResolvedValue([
        { ticker: 'AAPL', categoryId: 'cat-1', category: { id: 'cat-1', name: 'AI', color: '#3b82f6' } },
      ]),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('GET returns categories for ticker', async () => {
  const res = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.categories).toHaveLength(1)
  expect(data.categories[0].name).toBe('AI')
})

test('POST assigns category to ticker (uppercased)', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ categoryId: 'cat-1' }),
  })
  await POST(req, { params: Promise.resolve({ ticker: 'aapl' }) })
  expect(prisma.stockCategory.create).toHaveBeenCalledWith({
    data: { ticker: 'AAPL', categoryId: 'cat-1' },
  })
})

test('DELETE removes category from ticker', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ ticker: 'AAPL', categoryId: 'cat-1' }),
  })
  const data = await res.json()
  expect(data.ok).toBe(true)
})
