import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') ?? undefined
    const activities = await alpaca.getActivities({ activity_type: type })
    return NextResponse.json({ activities })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
