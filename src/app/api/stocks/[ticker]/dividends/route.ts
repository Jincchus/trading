import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface FmpDividend {
  date: string
  dividend: number
  recordDate: string
  paymentDate: string
  declarationDate: string
}

interface FormattedDividend {
  date: string
  amount: number
  recordDate: string
  paymentDate: string
}

interface CacheEntry {
  data: FormattedDividend[]
  expires: number
}

export const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 24 * 60 * 60 * 1000

function format(historical: FmpDividend[]): FormattedDividend[] {
  return historical.slice(0, 10).map((d) => ({
    date: d.date,
    amount: d.dividend,
    recordDate: d.recordDate,
    paymentDate: d.paymentDate,
  }))
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const symbol = ticker.toUpperCase()

    const cached = cache.get(symbol)
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ dividends: cached.data })
    }

    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${symbol}?apikey=${env.FMP_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`FMP API error: ${res.status}`)

    const json = await res.json() as { historical?: FmpDividend[] }
    const dividends = format(json.historical ?? [])

    cache.set(symbol, { data: dividends, expires: Date.now() + CACHE_TTL })
    return NextResponse.json({ dividends })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dividends'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
