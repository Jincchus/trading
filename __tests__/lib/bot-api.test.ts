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
