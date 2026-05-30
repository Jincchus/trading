import { GET, POST } from '@/app/api/categories/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    category: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'cat-1', name: 'AI', color: '#3b82f6' },
        { id: 'cat-2', name: '배당주', color: '#22c55e' },
      ]),
      create: jest.fn().mockResolvedValue({ id: 'cat-3', name: '성장주', color: '#f59e0b' }),
    },
  },
}))

test('GET returns all categories', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.categories).toHaveLength(2)
})

test('POST creates new category', async () => {
  const req = new NextRequest('http://localhost/api/categories', {
    method: 'POST',
    body: JSON.stringify({ name: '성장주', color: '#f59e0b' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.category.name).toBe('성장주')
})

test('POST returns 400 for missing name', async () => {
  const req = new NextRequest('http://localhost/api/categories', {
    method: 'POST',
    body: JSON.stringify({ color: '#3b82f6' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
