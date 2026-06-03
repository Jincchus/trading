import {
  formatUsd, formatPct, tabLabel, pnlColorClass,
  buildComparisonSeries, filterByPeriod,
} from '@/lib/bot-format'

test('formatUsd: 통화 포맷', () => {
  expect(formatUsd(10240)).toBe('$10,240.00')
  expect(formatUsd('9920.5')).toBe('$9,920.50')
})

test('formatPct: 분수 입력 → 부호 % 2자리', () => {
  expect(formatPct(0.024)).toBe('+2.40%')
  expect(formatPct(-0.015)).toBe('-1.50%')
  expect(formatPct(0)).toBe('+0.00%')
})

test('tabLabel: 이름 마지막 단어, 없으면 #id', () => {
  expect(tabLabel('MA 크로스오버 v1', 1)).toBe('v1')
  expect(tabLabel('', 3)).toBe('#3')
  expect(tabLabel('   ', 4)).toBe('#4')
})

test('pnlColorClass: 부호별 색상', () => {
  expect(pnlColorClass(5)).toBe('text-emerald-400')
  expect(pnlColorClass(-5)).toBe('text-red-400')
  expect(pnlColorClass(0)).toBe('text-gray-400')
})

test('buildComparisonSeries: budget 대비 % 시계열', () => {
  const history = [
    { timestamp: '2026-05-31T00:00:00', equity: '10000' },
    { timestamp: '2026-05-31T00:05:00', equity: '10240' },
  ]
  const series = buildComparisonSeries(history, 10000)
  expect(series[0].value).toBeCloseTo(0, 5)
  expect(series[1].value).toBeCloseTo(2.4, 5)
  expect(series[1].time).toBe(Math.floor(new Date('2026-05-31T00:05:00').getTime() / 1000))
})

test('filterByPeriod: 기간 필터', () => {
  const now = 1_000_000
  const series = [
    { time: now - 40 * 86400, value: 1 },
    { time: now - 10 * 86400, value: 2 },
    { time: now - 1 * 86400, value: 3 },
  ]
  expect(filterByPeriod(series, '7d', now).length).toBe(1)
  expect(filterByPeriod(series, '30d', now).length).toBe(2)
  expect(filterByPeriod(series, 'all', now).length).toBe(3)
})

import { normalizeSymbol, addSymbol } from '@/lib/bot-format'

test('normalizeSymbol: 공백 제거 + 대문자', () => {
  expect(normalizeSymbol('  tsla ')).toBe('TSLA')
})
test('addSymbol: 정규화해서 추가', () => {
  expect(addSymbol(['AAPL'], 'tsla')).toEqual(['AAPL', 'TSLA'])
})
test('addSymbol: 빈값 무시', () => {
  expect(addSymbol(['AAPL'], '   ')).toEqual(['AAPL'])
})
test('addSymbol: 중복(대소문자 무시) 무시', () => {
  expect(addSymbol(['AAPL'], 'aapl')).toEqual(['AAPL'])
})
