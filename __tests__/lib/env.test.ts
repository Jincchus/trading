import { parseEnv } from '@/lib/env'

const valid = {
  ALPACA_API_KEY: 'key',
  ALPACA_API_SECRET: 'secret',
  FMP_API_KEY: 'fmp',
  EXCHANGE_RATE_API_KEY: 'er',
  VAPID_PUBLIC_KEY: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  VAPID_PRIVATE_KEY: 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSkFU',
}

test('valid env passes with defaults', () => {
  const result = parseEnv(valid as NodeJS.ProcessEnv)
  expect(result.ALPACA_API_KEY).toBe('key')
  expect(result.ALPACA_BASE_URL).toBe('https://api.alpaca.markets')
  expect(result.PORT).toBe('3000')
})

test('missing required key throws', () => {
  expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow('Invalid environment variables')
})

test('custom PORT is respected', () => {
  const result = parseEnv({ ...valid, PORT: '8080' } as NodeJS.ProcessEnv)
  expect(result.PORT).toBe('8080')
})
