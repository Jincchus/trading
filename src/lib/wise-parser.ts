import Papa from 'papaparse'

export interface WiseFxEntry {
  date: Date
  krwAmount: number
  usdAmount: number
  exchangeRate: number
  source: 'wise'
}

export function parseWiseCsv(csvText: string): WiseFxEntry[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  return result.data
    .filter((row) => {
      const exchangeFrom = row['Exchange From'] ?? ''
      const exchangeTo = row['Exchange To'] ?? ''
      return (
        exchangeFrom.toUpperCase().includes('KRW') &&
        exchangeTo.toUpperCase().includes('USD')
      )
    })
    .map((row) => {
      const krwRaw = (row['Exchange From'] ?? '').replace(/[^0-9.]/g, '')
      const usdRaw = (row['Amount'] ?? '').replace(/[^0-9.]/g, '')
      const krwAmount = parseFloat(krwRaw)
      const usdAmount = parseFloat(usdRaw)

      return {
        date: new Date(row['Date'] ?? ''),
        krwAmount,
        usdAmount,
        exchangeRate: usdAmount > 0 ? krwAmount / usdAmount : 0,
        source: 'wise' as const,
      }
    })
    .filter(
      (e) =>
        !isNaN(e.krwAmount) &&
        !isNaN(e.usdAmount) &&
        e.usdAmount > 0 &&
        e.krwAmount > 0 &&
        !isNaN(e.date.getTime())
    )
}
