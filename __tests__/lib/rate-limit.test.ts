import { createRateLimiter, clientIp } from '@/lib/rate-limit'

test('allows up to max attempts then blocks', () => {
  const rl = createRateLimiter(3, 60_000)
  expect(rl.check('1.1.1.1', 0)).toBe(false)
  expect(rl.check('1.1.1.1', 0)).toBe(false)
  expect(rl.check('1.1.1.1', 0)).toBe(false)
  expect(rl.check('1.1.1.1', 0)).toBe(true) // 4th within window
})

test('resets after the window elapses', () => {
  const rl = createRateLimiter(2, 60_000)
  rl.check('1.1.1.1', 0)
  rl.check('1.1.1.1', 0)
  expect(rl.check('1.1.1.1', 0)).toBe(true)
  expect(rl.check('1.1.1.1', 60_001)).toBe(false) // window passed
})

test('keys are isolated per client', () => {
  const rl = createRateLimiter(1, 60_000)
  expect(rl.check('1.1.1.1', 0)).toBe(false)
  expect(rl.check('2.2.2.2', 0)).toBe(false)
})

test('sweeps expired entries to avoid unbounded growth', () => {
  const rl = createRateLimiter(5, 60_000)
  rl.check('1.1.1.1', 0)
  rl.check('2.2.2.2', 0)
  expect(rl.size).toBe(2)
  // A later call past the window sweeps the stale entries.
  rl.check('3.3.3.3', 120_000)
  expect(rl.size).toBe(1)
})

test('clientIp takes the leftmost forwarded address', () => {
  expect(clientIp('203.0.113.5, 70.41.3.18, 150.172.238.178', null)).toBe('203.0.113.5')
})

test('clientIp falls back to x-real-ip then unknown', () => {
  expect(clientIp(null, '198.51.100.7')).toBe('198.51.100.7')
  expect(clientIp(null, null)).toBe('unknown')
})
