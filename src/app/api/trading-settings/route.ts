import { NextRequest, NextResponse } from 'next/server'
import { isTradingEnabled, setTradingEnabled } from '@/lib/trading-settings'
import { alpaca } from '@/lib/alpaca/client'

export async function GET() {
  const enabled = await isTradingEnabled()
  return NextResponse.json({ tradingEnabled: enabled })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { tradingEnabled?: boolean }
  const enabled = Boolean(body.tradingEnabled)

  if (!enabled) {
    // Cancel all open orders when disabling trading
    try {
      const openOrders = await alpaca.getOrders({ status: 'open', limit: 100 })
      await Promise.allSettled(openOrders.map((o) => alpaca.cancelOrder(o.id)))
      console.log(`[KillSwitch] Cancelled ${openOrders.length} open orders`)
    } catch (e) {
      console.error('[KillSwitch] Cancel failed:', e)
    }
  }

  await setTradingEnabled(enabled)
  return NextResponse.json({ tradingEnabled: enabled })
}
