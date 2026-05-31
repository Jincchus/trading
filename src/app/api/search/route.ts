import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface AlpacaAsset {
  symbol: string
  name: string
  exchange: string
  status: string
  tradable: boolean
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    const url = `${env.ALPACA_BASE_URL}/v2/assets?search=${encodeURIComponent(q)}&status=active&asset_class=us_equity`
    const res = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET,
      },
    })
    if (!res.ok) return NextResponse.json({ results: [] })

    const assets = await res.json() as AlpacaAsset[]
    const results = assets
      .filter((a) => a.tradable && a.status === 'active')
      .slice(0, 10)
      .map((a) => ({
        symbol: a.symbol,
        name: a.name,
        exchange: a.exchange,
        type: 'stock',
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
