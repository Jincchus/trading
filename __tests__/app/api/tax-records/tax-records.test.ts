import { GET } from '@/app/api/tax-records/route'

jest.mock('@/lib/db', () => ({
  prisma: {
    taxRecord: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tr-1', lotId: 'lot-1', ticker: 'AAPL',
          acquireDate: new Date('2024-01-15'), acquirePrice: 150, acquireRate: 1300,
          saleDate: new Date('2024-03-01'), salePrice: 175, saleRate: 1320,
          quantity: 3, gainKrw: 99000, createdAt: new Date(),
        },
      ]),
    },
  },
}))

test('GET returns tax records with summary', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.records).toHaveLength(1)
  expect(data.totalGainKrw).toBe(99000)
  expect(data.taxableGainKrw).toBe(0) // 99000 < 2500000
  expect(data.estimatedTaxKrw).toBe(0)
})

test('GET calculates tax correctly when gain exceeds exemption', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.taxRecord.findMany.mockResolvedValueOnce([
    {
      id: 'tr-1', lotId: 'lot-1', ticker: 'AAPL',
      acquireDate: new Date('2024-01-15'), acquirePrice: 100, acquireRate: 1300,
      saleDate: new Date('2024-03-01'), salePrice: 200, saleRate: 1320,
      quantity: 100, gainKrw: 13200000, createdAt: new Date(),
    },
  ])
  const res = await GET()
  const data = await res.json()
  expect(data.taxableGainKrw).toBe(10700000)
  expect(data.estimatedTaxKrw).toBeCloseTo(10700000 * 0.22, 0)
})
