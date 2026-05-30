import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    const orders = await alpaca.getOrders({ status: 'filled', limit: 500 })
    const buyOrders = orders.filter(
      (o) => o.side === 'buy' && o.filled_qty && o.filled_avg_price && o.filled_at
    )

    await Promise.all(
      buyOrders.map((order) =>
        prisma.lot.upsert({
          where: { alpacaOrderId: order.id },
          update: {},
          create: {
            ticker: order.symbol,
            quantity: parseFloat(order.filled_qty),
            purchasePrice: parseFloat(order.filled_avg_price!),
            purchaseDate: new Date(order.filled_at!),
            alpacaOrderId: order.id,
          },
        })
      )
    )

    return NextResponse.json({ synced: buyOrders.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
