import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface FmpPriceRow {
  date: string
  dividend?: number
  adjDividend?: number
  paymentDate?: string
  recordDate?: string
  declarationDate?: string
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

    const url = `https://financialmodelingprep.com/stable/historical-price-eod/dividend-adjusted?symbol=${symbol}&apikey=${env.FMP_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[Dividends] FMP API error ${res.status} for ${symbol}`)
      return NextResponse.json({ dividends: [] }, { status: 502 })
    }

    const json = await res.json() as FmpPriceRow[] | { historical?: FmpPriceRow[] }
    const rows: FmpPriceRow[] = Array.isArray(json) ? json : (json.historical ?? [])

    const dividends: FormattedDividend[] = rows
      .filter((r) => r.dividend && r.dividend > 0)
      .slice(0, 10)
      .map((r) => ({
        date: r.date,
        amount: r.dividend!,
        recordDate: r.recordDate ?? r.date,
        paymentDate: r.paymentDate ?? r.date,
      }))

    cache.set(symbol, { data: dividends, expires: Date.now() + CACHE_TTL })
    return NextResponse.json({ dividends })
  } catch (err) {
    console.warn('[Dividends] fetch failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ dividends: [] })
  }
}
