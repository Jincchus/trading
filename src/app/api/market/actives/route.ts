import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface FmpActive {
  symbol: string
  name: string
  changesPercentage: number
  price: number
  volume: number
}

let cache: { data: FmpActive[]; expires: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json({ actives: cache.data })
  }

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/actives?apikey=${env.FMP_API_KEY}`
    )
    if (!res.ok) return NextResponse.json({ actives: [] })

    const data = await res.json() as FmpActive[]
    cache = { data: data.slice(0, 15), expires: Date.now() + CACHE_TTL }
    return NextResponse.json({ actives: cache.data })
  } catch {
    return NextResponse.json({ actives: [] })
  }
}
