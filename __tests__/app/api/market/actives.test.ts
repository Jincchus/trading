beforeEach(() => {
  jest.resetModules()
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      { symbol: 'NVDA', name: 'NVIDIA', changesPercentage: 3.5, price: 875.0, volume: 50000000 },
      { symbol: 'TSLA', name: 'Tesla', changesPercentage: -1.2, price: 250.0, volume: 40000000 },
    ]),
  } as Response)
})

test('GET returns most active stocks', async () => {
  const { GET } = await import('@/app/api/market/actives/route')
  const res = await GET()
  const data = await res.json()
  expect(data.actives).toHaveLength(2)
  expect(data.actives[0].symbol).toBe('NVDA')
})

test('GET returns empty array on FMP error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
  const { GET } = await import('@/app/api/market/actives/route')
  const res = await GET()
  expect((await res.json()).actives).toHaveLength(0)
})
