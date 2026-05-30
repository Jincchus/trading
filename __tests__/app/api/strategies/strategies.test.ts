import { GET, POST } from '@/app/api/strategies/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    strategy: {
      findMany: jest.fn().mockResolvedValue([
        { id: 's-1', name: '성장주 전략', rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
      ]),
      create: jest.fn().mockResolvedValue({ id: 's-2', name: '배당주 전략', rules: [] }),
    },
  },
}))

test('GET returns strategies with rules', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.strategies).toHaveLength(1)
  expect(data.strategies[0].rules).toHaveLength(1)
})

test('POST creates strategy', async () => {
  const req = new NextRequest('http://localhost/api/strategies', {
    method: 'POST',
    body: JSON.stringify({ name: '배당주 전략' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  expect((await res.json()).strategy.name).toBe('배당주 전략')
})

test('POST returns 400 for missing name', async () => {
  const req = new NextRequest('http://localhost/api/strategies', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
