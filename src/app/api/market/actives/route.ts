import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

const TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD', 'NFLX', 'JPM', 'SPY', 'QQQ']

interface ActiveStock {
  symbol: string
  name: string
  price: number
  changesPercentage: number
  volume: number
}

let cache: { data: ActiveStock[]; expires: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json({ actives: cache.data })
  }

  try {
    const symbols = TICKERS.join(',')
    const res = await fetch(
      `${env.ALPACA_DATA_URL}/v2/stocks/snapshots?symbols=${symbols}&feed=iex`,
      {
        headers: {
          'APCA-API-KEY-ID': env.ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET,
        },
      }
    )
    if (!res.ok) return NextResponse.json({ actives: [] })

    const snapshots = await res.json() as Record<string, {
      latestTrade?: { p: number }
      prevDailyBar?: { c: number }
      dailyBar?: { v: number }
    }>

    const actives: ActiveStock[] = Object.entries(snapshots).map(([symbol, snap]) => {
      const price = snap.latestTrade?.p ?? 0
      const prevClose = snap.prevDailyBar?.c ?? price
      const changesPercentage = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
      return {
        symbol,
        name: symbol,
        price,
        changesPercentage,
        volume: snap.dailyBar?.v ?? 0,
      }
    }).sort((a, b) => Math.abs(b.changesPercentage) - Math.abs(a.changesPercentage))

    cache = { data: actives, expires: Date.now() + CACHE_TTL }
    return NextResponse.json({ actives })
  } catch {
    return NextResponse.json({ actives: [] })
  }
}
