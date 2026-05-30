import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'
import { prisma } from '@/lib/db'
import { getCurrentKrwRate } from '@/lib/exchange-rate'

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') ?? 'all'
    const orders = await alpaca.getOrders({ status, limit: 100 })
    return NextResponse.json({ orders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch orders'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      ticker: string
      side: 'buy' | 'sell'
      type: 'market' | 'limit'
      qty?: number
      notional?: number
      limitPrice?: number
      extendedHours?: boolean
      lotId?: string
    }

    const order = await alpaca.placeOrder({
      symbol: body.ticker.toUpperCase(),
      side: body.side,
      type: body.type,
      time_in_force: body.type === 'market' ? 'day' : 'gtc',
      ...(body.qty && { qty: String(body.qty) }),
      ...(body.notional && { notional: String(body.notional) }),
      ...(body.limitPrice && { limit_price: String(body.limitPrice) }),
      ...(body.extendedHours && { extended_hours: true }),
    })

    if (
      body.side === 'buy' &&
      order.status === 'filled' &&
      order.filled_avg_price &&
      order.filled_qty &&
      order.filled_at
    ) {
      await prisma.lot.create({
        data: {
          ticker: body.ticker.toUpperCase(),
          quantity: parseFloat(order.filled_qty),
          purchasePrice: parseFloat(order.filled_avg_price),
          purchaseDate: new Date(order.filled_at),
          alpacaOrderId: order.id,
        },
      })
    }

    if (
      body.side === 'sell' &&
      body.lotId &&
      order.status === 'filled' &&
      order.filled_qty &&
      order.filled_avg_price &&
      order.filled_at
    ) {
      const filledQty = parseFloat(order.filled_qty)
      const salePrice = parseFloat(order.filled_avg_price)
      const lot = await prisma.lot.findUnique({ where: { id: body.lotId } })
      if (lot) {
        const newSold = lot.soldQuantity + filledQty
        const saleRate = await getCurrentKrwRate()

        let acquireRate = saleRate
        const closestFxRecord = await prisma.fxRecord.findFirst({
          where: { date: { lte: lot.purchaseDate } },
          orderBy: { date: 'desc' },
        })
        if (closestFxRecord) {
          acquireRate = closestFxRecord.exchangeRate
        }

        const gainKrw = (salePrice - lot.purchasePrice) * filledQty * saleRate

        await Promise.all([
          prisma.lot.update({
            where: { id: body.lotId },
            data: {
              soldQuantity: newSold,
              status: newSold >= lot.quantity ? 'fully_sold' : 'active',
            },
          }),
          prisma.taxRecord.create({
            data: {
              lotId: body.lotId,
              ticker: lot.ticker,
              acquireDate: lot.purchaseDate,
              acquirePrice: lot.purchasePrice,
              acquireRate: acquireRate,
              saleDate: new Date(order.filled_at),
              salePrice,
              saleRate,
              quantity: filledQty,
              gainKrw,
            },
          }),
        ])
      }
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Order failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
