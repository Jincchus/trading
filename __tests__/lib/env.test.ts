import { parseEnv } from '@/lib/env'

const valid = {
  ALPACA_API_KEY: 'key',
  ALPACA_API_SECRET: 'secret',
  FMP_API_KEY: 'fmp',
  EXCHANGE_RATE_API_KEY: 'er',
  VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  VAPID_PRIVATE_KEY: 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSkFU',
  APP_PASSWORD: 'test-password',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  BOT_API_TOKEN: 'test-bot-api-token-1234567890',
}

test('valid env passes with defaults', () => {
  const result = parseEnv(valid as unknown as NodeJS.ProcessEnv)
  expect(result.ALPACA_API_KEY).toBe('key')
  // ALPACA_BASE_URL is optional in the schema; the live/paper URL is derived
  // from ALPACA_TRADING_MODE in the exported `ALPACA_BASE_URL` constant.
  expect(result.ALPACA_BASE_URL).toBeUndefined()
  expect(result.ALPACA_TRADING_MODE).toBe('paper')
  expect(result.PORT).toBe('3000')
})

test('missing required key throws', () => {
  expect(() => parseEnv({} as unknown as NodeJS.ProcessEnv)).toThrow('Invalid environment variables')
})

test('custom PORT is respected', () => {
  const result = parseEnv({ ...valid, PORT: '8080' } as unknown as NodeJS.ProcessEnv)
  expect(result.PORT).toBe('8080')
})
