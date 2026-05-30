import { buildWsManager, PriceUpdate } from '@/lib/alpaca/ws-server'

const cfg = { apiKey: 'k', apiSecret: 's', wsUrl: 'wss://x' }

test('subscribeTicker adds ticker', () => {
  const mgr = buildWsManager(cfg)
  mgr.subscribeTicker('AAPL')
  expect(mgr.getSubscribedTickers()).toContain('AAPL')
})

test('subscribeTicker ignores duplicate', () => {
  const mgr = buildWsManager(cfg)
  mgr.subscribeTicker('AAPL')
  mgr.subscribeTicker('AAPL')
  expect(mgr.getSubscribedTickers().filter((t: string) => t === 'AAPL')).toHaveLength(1)
})

test('broadcast sends to open clients only', () => {
  const mgr = buildWsManager(cfg)
  const sent: string[] = []
  const openClient = { readyState: 1, send: (m: string) => sent.push(m), on: () => {} }
  const closedClient = { readyState: 3, send: jest.fn(), on: () => {} }
  mgr.registerBrowserClient(openClient as any)
  mgr.registerBrowserClient(closedClient as any)
  mgr.broadcastForTest({ ticker: 'AAPL', price: 150, timestamp: 'ts' })
  expect(sent).toHaveLength(1)
  expect(JSON.parse(sent[0])).toMatchObject({ ticker: 'AAPL', price: 150 })
  expect(closedClient.send).not.toHaveBeenCalled()
})
