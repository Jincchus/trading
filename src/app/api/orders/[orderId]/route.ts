import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    await alpaca.cancelOrder(orderId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancel failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
