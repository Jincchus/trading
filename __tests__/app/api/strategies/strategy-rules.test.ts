import { POST } from '@/app/api/strategies/[id]/rules/route'
import { DELETE } from '@/app/api/strategies/[id]/rules/[ruleId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    strategyRule: {
      create: jest.fn().mockResolvedValue({ id: 'r-2', threshold: 50, sellPct: 50, strategyId: 's-1' }),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('POST adds rule to strategy', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ threshold: 50, sellPct: 50 }),
  })
  const res = await POST(req, { params: Promise.resolve({ id: 's-1' }) })
  expect(res.status).toBe(201)
  expect((await res.json()).rule.threshold).toBe(50)
})

test('POST returns 400 if sellPct > 100', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ threshold: 20, sellPct: 150 }),
  })
  const res = await POST(req, { params: Promise.resolve({ id: 's-1' }) })
  expect(res.status).toBe(400)
})

test('POST allows negative threshold for stop-loss', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.strategyRule.create.mockResolvedValueOnce({ id: 'r-3', threshold: -15, sellPct: 100, strategyId: 's-1' })
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ threshold: -15, sellPct: 100 }),
  })
  const res = await POST(req, { params: Promise.resolve({ id: 's-1' }) })
  expect(res.status).toBe(201)
  expect((await res.json()).rule.threshold).toBe(-15)
})

test('DELETE removes rule', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ id: 's-1', ruleId: 'r-1' }),
  })
  expect((await res.json()).ok).toBe(true)
})
