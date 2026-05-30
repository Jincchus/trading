import { DELETE } from '@/app/api/fx-records/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    fxRecord: {
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('DELETE removes fx record', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'fx-1' }) })
  expect((await res.json()).ok).toBe(true)
})
