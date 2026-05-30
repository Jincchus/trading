import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const data = await alpaca.getLatestQuote(ticker.toUpperCase())
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch quote'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
