import { PUT, DELETE } from '@/app/api/strategies/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    strategy: {
      update: jest.fn().mockResolvedValue({ id: 's-1', name: '수정됨', rules: [] }),
      delete: jest.fn().mockResolvedValue({}),
    },
    lot: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

test('PUT updates strategy name', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'PUT',
    body: JSON.stringify({ name: '수정됨' }),
  })
  const res = await PUT(req, { params: Promise.resolve({ id: 's-1' }) })
  expect((await res.json()).strategy.name).toBe('수정됨')
})

test('DELETE unassigns lots then deletes', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 's-1' }) })
  expect(prisma.lot.updateMany).toHaveBeenCalledWith({
    where: { strategyId: 's-1' },
    data: { strategyId: null },
  })
  expect(prisma.strategy.delete).toHaveBeenCalledWith({ where: { id: 's-1' } })
  expect((await res.json()).ok).toBe(true)
})
