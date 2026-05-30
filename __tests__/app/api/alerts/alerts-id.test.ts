import { DELETE } from '@/app/api/alerts/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    alert: { delete: jest.fn().mockResolvedValue({}) },
  },
}))

test('DELETE removes alert', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'a-1' }) })
  expect((await res.json()).ok).toBe(true)
})
