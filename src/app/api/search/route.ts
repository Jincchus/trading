import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface FmpSearchResult {
  symbol: string
  name: string
  currency: string
  exchangeShortName: string
}

const STOCK_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX', 'NYSE ARCA', 'OTC'])

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    const url = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=15&apikey=${env.FMP_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ results: [] })

    const raw = await res.json() as FmpSearchResult[]
    const results = raw
      .filter((r) => STOCK_EXCHANGES.has(r.exchangeShortName))
      .slice(0, 10)
      .map((r) => ({
        symbol: r.symbol,
        name: r.name,
        exchange: r.exchangeShortName,
        type: 'stock',
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
