import { GET, cache } from '@/app/api/stocks/[ticker]/dividends/route'

beforeEach(() => {
  cache.clear()

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      historical: [
        { date: '2024-02-09', dividend: 0.24, recordDate: '2024-02-12', paymentDate: '2024-02-15', declarationDate: '2024-02-01' },
        { date: '2023-11-10', dividend: 0.24, recordDate: '2023-11-13', paymentDate: '2023-11-16', declarationDate: '2023-11-01' },
      ],
    }),
  } as Response)
})

test('GET returns formatted dividend history', async () => {
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.dividends).toHaveLength(2)
  expect(data.dividends[0].amount).toBe(0.24)
  expect(data.dividends[0].date).toBe('2024-02-09')
})

test('GET returns empty array when no historical dividends', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ historical: [] }),
  } as Response)
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'BRKB' }) })
  const data = await res.json()
  expect(data.dividends).toHaveLength(0)
})

test('GET returns 502 on FMP API error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 } as Response)
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'AAPL' }) })
  expect(res.status).toBe(502)
})
