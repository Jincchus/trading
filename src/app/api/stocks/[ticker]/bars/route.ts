import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day' | '1Week' | '1Month'
const VALID_TIMEFRAMES: Timeframe[] = ['1Min', '5Min', '15Min', '1Hour', '1Day', '1Week', '1Month']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const { searchParams } = req.nextUrl
    const DEFAULT_TIMEFRAME = '1Day' as const satisfies Timeframe
    const timeframe = (searchParams.get('timeframe') ?? DEFAULT_TIMEFRAME) as Timeframe

    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })
    }

    const start = searchParams.get('start') ?? undefined
    const end = searchParams.get('end') ?? undefined
    const limitStr = searchParams.get('limit')
    const limit = limitStr !== null && !isNaN(Number(limitStr)) && Number(limitStr) > 0
      ? Number(limitStr)
      : undefined

    const data = await alpaca.getBars(ticker.toUpperCase(), { timeframe, start, end, limit })
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch bars'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
