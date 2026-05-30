import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const items = await prisma.watchlist.findMany({ orderBy: { addedAt: 'desc' } })
  return NextResponse.json({ tickers: items.map((w) => w.ticker) })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticker?: string }
    if (!body.ticker?.trim()) {
      return NextResponse.json({ error: 'Ticker required' }, { status: 400 })
    }
    const item = await prisma.watchlist.create({
      data: { ticker: body.ticker.trim().toUpperCase() },
    })
    return NextResponse.json({ ticker: item.ticker }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
