import { getStrategies, startStrategy, BOT_API } from '@/lib/bot-api'

afterEach(() => { jest.restoreAllMocks() })

test('getStrategies: GET /strategies 호출 + JSON 반환', async () => {
  const fake = [{ id: 1, name: 'v1', strategy_type: 'ma_crossover', budget: '10000',
                  status: 'running', run_interval: '1m', created_at: '2026-05-31T00:00:00' }]
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(fake), { status: 200 }),
  )
  const result = await getStrategies()
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/strategies`, expect.anything())
  expect(result[0].name).toBe('v1')
})

test('startStrategy: POST /strategies/{id}/start', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ message: 'started' }), { status: 200 }),
  )
  await startStrategy(2)
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/strategies/2/start`,
    expect.objectContaining({ method: 'POST' }))
})

test('getStrategies: 오류 응답 시 throw', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('err', { status: 500 }))
  await expect(getStrategies()).rejects.toThrow()
})

import {
  getWatchlist, updateWatchlist, patchStrategy,
  closePosition, liquidateStrategy, liquidateAll,
} from '@/lib/bot-api'

test('getWatchlist: GET /watchlist', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ symbols: ['AAPL'] }), { status: 200 }))
  const r = await getWatchlist()
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/watchlist`, expect.anything())
  expect(r.symbols).toEqual(['AAPL'])
})

test('updateWatchlist: PUT /watchlist + body', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ symbols: ['TSLA', 'AMD'] }), { status: 200 }))
  await updateWatchlist(['TSLA', 'AMD'])
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/watchlist`, expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ symbols: ['TSLA', 'AMD'] }) }))
})

test('updateWatchlist: 400 시 detail 메시지로 throw', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(
    JSON.stringify({ detail: "invalid or non-tradable symbols: ['APPL']" }), { status: 400 }))
  await expect(updateWatchlist(['APPL'])).rejects.toThrow('invalid or non-tradable symbols')
})

test('patchStrategy: PATCH /strategies/{id} + position_size', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ id: 1, position_size: '0.1' }), { status: 200 }))
  await patchStrategy(1, 0.1)
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/strategies/1`, expect.objectContaining({
    method: 'PATCH', body: JSON.stringify({ position_size: 0.1 }) }))
})

test('closePosition: POST close path', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  await closePosition(2, 'AAPL')
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/strategies/2/positions/AAPL/close`,
    expect.objectContaining({ method: 'POST' }))
})

test('liquidateStrategy: POST /strategies/{id}/liquidate', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  await liquidateStrategy(3)
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/strategies/3/liquidate`,
    expect.objectContaining({ method: 'POST' }))
})

test('liquidateAll: POST /liquidate-all', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  await liquidateAll()
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/liquidate-all`,
    expect.objectContaining({ method: 'POST' }))
})
