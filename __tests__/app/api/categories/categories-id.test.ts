import { PUT, DELETE } from '@/app/api/categories/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    category: {
      update: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Updated', color: '#ef4444' }),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('PUT updates category', async () => {
  const req = new NextRequest('http://localhost/api/categories/cat-1', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Updated', color: '#ef4444' }),
  })
  const res = await PUT(req, { params: Promise.resolve({ id: 'cat-1' }) })
  const data = await res.json()
  expect(data.category.name).toBe('Updated')
})

test('DELETE removes category', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'cat-1' }) })
  const data = await res.json()
  expect(data.ok).toBe(true)
})
