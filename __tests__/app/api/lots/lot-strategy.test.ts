import { PATCH } from '@/app/api/lots/[id]/strategy/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      update: jest.fn().mockResolvedValue({ id: 'lot-1', strategyId: 's-1' }),
    },
  },
}))

test('PATCH assigns strategy to lot', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'PATCH',
    body: JSON.stringify({ strategyId: 's-1' }),
  })
  const res = await PATCH(req, { params: Promise.resolve({ id: 'lot-1' }) })
  const data = await res.json()
  expect(data.lot.strategyId).toBe('s-1')
  const { prisma } = jest.requireMock('@/lib/db')
  expect(prisma.lot.update).toHaveBeenCalledWith({
    where: { id: 'lot-1' },
    data: { strategyId: 's-1' },
  })
})

test('PATCH unassigns strategy with null', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.update.mockResolvedValueOnce({ id: 'lot-1', strategyId: null })
  const req = new NextRequest('http://localhost', {
    method: 'PATCH',
    body: JSON.stringify({ strategyId: null }),
  })
  await PATCH(req, { params: Promise.resolve({ id: 'lot-1' }) })
  expect(prisma.lot.update).toHaveBeenCalledWith({
    where: { id: 'lot-1' },
    data: { strategyId: null },
  })
})
