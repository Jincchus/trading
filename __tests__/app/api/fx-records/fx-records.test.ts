import { GET, POST } from '@/app/api/fx-records/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    fxRecord: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'fx-1', date: new Date('2024-01-15'), krwAmount: 1300000, usdAmount: 1000, exchangeRate: 1300, source: 'wise', createdAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue(
        { id: 'fx-2', date: new Date('2024-02-01'), krwAmount: 650000, usdAmount: 500, exchangeRate: 1300, source: 'manual', createdAt: new Date() }
      ),
    },
  },
}))

test('GET returns fx records ordered by date desc', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.records).toHaveLength(1)
  expect(data.records[0].source).toBe('wise')
})

test('POST creates manual fx record', async () => {
  const req = new NextRequest('http://localhost/api/fx-records', {
    method: 'POST',
    body: JSON.stringify({ date: '2024-02-01', krwAmount: 650000, usdAmount: 500 }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.record.source).toBe('manual')
})

test('POST returns 400 for invalid amounts', async () => {
  const req = new NextRequest('http://localhost/api/fx-records', {
    method: 'POST',
    body: JSON.stringify({ date: '2024-02-01', krwAmount: -100, usdAmount: 500 }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
