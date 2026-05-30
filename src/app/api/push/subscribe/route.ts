import { NextRequest, NextResponse } from 'next/server'
import { savePushSubscription, getPushSubscription, deletePushSubscription } from '@/lib/push-store'

export async function GET() {
  const sub = getPushSubscription()
  return NextResponse.json({ subscribed: sub !== null })
}

export async function POST(req: NextRequest) {
  const sub = await req.json()
  savePushSubscription(sub)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  deletePushSubscription()
  return NextResponse.json({ ok: true })
}
