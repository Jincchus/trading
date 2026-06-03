import { signSession, verifySession, SESSION_MAX_AGE_MS } from '@/lib/session'

afterEach(() => {
  jest.restoreAllMocks()
})

test('accepts a freshly signed token', () => {
  const token = signSession()
  expect(verifySession(token)).toBe(true)
})

test('rejects a token whose age exceeds SESSION_MAX_AGE_MS', () => {
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
  const token = signSession()
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000 + SESSION_MAX_AGE_MS + 1)
  expect(verifySession(token)).toBe(false)
})

test('accepts a token still within SESSION_MAX_AGE_MS', () => {
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
  const token = signSession()
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000 + SESSION_MAX_AGE_MS - 1)
  expect(verifySession(token)).toBe(true)
})

test('rejects a tampered token', () => {
  const token = signSession()
  expect(verifySession(token + 'x')).toBe(false)
})

test('rejects a token with a non-numeric timestamp', () => {
  expect(verifySession('auth.notanumber.deadbeef')).toBe(false)
})
