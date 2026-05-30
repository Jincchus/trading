import { shouldRun } from '@/lib/recurring'

const DAY = 24 * 60 * 60 * 1000

test('shouldRun returns true when lastRun is null', () => {
  expect(shouldRun('daily', null, new Date())).toBe(true)
})

test('shouldRun daily: true when 24h passed', () => {
  const lastRun = new Date(Date.now() - DAY - 1000)
  expect(shouldRun('daily', lastRun, new Date())).toBe(true)
})

test('shouldRun daily: false when less than 24h', () => {
  const lastRun = new Date(Date.now() - DAY + 60000)
  expect(shouldRun('daily', lastRun, new Date())).toBe(false)
})

test('shouldRun weekly: true when 7 days passed', () => {
  const lastRun = new Date(Date.now() - 7 * DAY - 1000)
  expect(shouldRun('weekly', lastRun, new Date())).toBe(true)
})

test('shouldRun monthly: true when 30 days passed', () => {
  const lastRun = new Date(Date.now() - 30 * DAY - 1000)
  expect(shouldRun('monthly', lastRun, new Date())).toBe(true)
})

test('shouldRun unknown frequency: false', () => {
  expect(shouldRun('hourly', null, new Date())).toBe(false)
})
