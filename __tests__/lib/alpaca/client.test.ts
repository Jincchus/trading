import { buildAlpacaClient } from '@/lib/alpaca/client'

const cfg = {
  ALPACA_API_KEY: 'test-key',
  ALPACA_API_SECRET: 'test-secret',
  ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
}

function mockFetch(data: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

test('getAccount returns account data with correct headers', async () => {
  mockFetch({ equity: '15000.00', buying_power: '10000.00', cash: '5000.00', portfolio_value: '15000.00' })
  const client = buildAlpacaClient(cfg)
  const result = await client.getAccount()
  expect(result.equity).toBe('15000.00')
  expect(global.fetch).toHaveBeenCalledWith(
    'https://paper-api.alpaca.markets/v2/account',
    expect.objectContaining({
      headers: expect.objectContaining({ 'APCA-API-KEY-ID': 'test-key' }),
    })
  )
})

test('getPositions returns position list', async () => {
  mockFetch([{ symbol: 'AAPL', qty: '10', avg_entry_price: '150.00', current_price: '175.00', unrealized_pl: '250.00', unrealized_plpc: '0.1667' }])
  const client = buildAlpacaClient(cfg)
  const result = await client.getPositions()
  expect(result[0].symbol).toBe('AAPL')
})

test('throws on API error', async () => {
  mockFetch({ message: 'Unauthorized' }, 401)
  const client = buildAlpacaClient(cfg)
  await expect(client.getAccount()).rejects.toThrow('Alpaca API error: 401')
})

describe('data API methods', () => {
  test('getBars calls data URL with correct params', async () => {
    mockFetch({ bars: [{ t: '2024-01-15T09:30:00Z', o: 150, h: 155, l: 148, c: 152, v: 1000000 }] })
    const client = buildAlpacaClient({ ...cfg, ALPACA_DATA_URL: 'https://data.alpaca.markets' })
    const result = await client.getBars('AAPL', { timeframe: '1Day' })
    expect(result.bars[0].c).toBe(152)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('data.alpaca.markets/v2/stocks/AAPL/bars'),
      expect.any(Object)
    )
  })

  test('getLatestQuote returns quote data', async () => {
    mockFetch({ quote: { t: '2024-01-15T09:30:00Z', ap: 150.5, as: 100, bp: 150.0, bs: 200 } })
    const client = buildAlpacaClient({ ...cfg, ALPACA_DATA_URL: 'https://data.alpaca.markets' })
    const result = await client.getLatestQuote('AAPL')
    expect(result.quote.ap).toBe(150.5)
  })
})
