import { parseWiseCsv } from '@/lib/wise-parser'

const SAMPLE_CSV = `TransferWise ID,Date,Amount,Currency,Description,Payment Reference,Running Balance,Exchange From,Exchange To,Exchange Rate,Payer Name,Payee Name
TW-001,2024-01-15,769.23,USD,Converted from KRW to USD,,769.23,1000000 KRW,769.23 USD,1300.00,,
TW-002,2024-01-20,384.62,USD,Converted from KRW to USD,,1153.85,500000 KRW,384.62 USD,1300.00,,
TW-003,2024-01-25,100.00,EUR,Transfer to friend,,1053.85,,,,,
`

test('parseWiseCsv extracts KRW→USD conversions only', () => {
  const result = parseWiseCsv(SAMPLE_CSV)
  expect(result).toHaveLength(2)
})

test('parseWiseCsv extracts correct amounts', () => {
  const result = parseWiseCsv(SAMPLE_CSV)
  expect(result[0].krwAmount).toBe(1000000)
  expect(result[0].usdAmount).toBe(769.23)
  expect(result[0].exchangeRate).toBeCloseTo(1300, 0)
})

test('parseWiseCsv parses dates correctly', () => {
  const result = parseWiseCsv(SAMPLE_CSV)
  expect(result[0].date.toISOString().slice(0, 10)).toBe('2024-01-15')
})

test('parseWiseCsv returns empty array for empty CSV', () => {
  expect(parseWiseCsv('Date,Amount,Currency\n')).toHaveLength(0)
})
