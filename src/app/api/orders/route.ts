import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'
import { prisma } from '@/lib/db'
import { getCurrentKrwRate } from '@/lib/exchange-rate'
import { sendPushNotification } from '@/lib/push'
import { orderSchema } from '@/lib/order-schema'
import { isTradingEnabled } from '@/lib/trading-settings'

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
  let audit: Awaited<ReturnType<typeof prisma.orderAudit.create>> | null = null
  try {
    const raw = await req.json()
    const parsed = orderSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    if (!(await isTradingEnabled())) {
      return NextResponse.json({ error: '자동매매가 정지된 상태입니다. 설정에서 재개하세요.' }, { status: 403 })
    }

    const body = parsed.data

    // Create audit record before placing order
    audit = await prisma.orderAudit.create({
      data: {
        source: 'manual',
        clientOrderId: body.clientOrderId,
        ticker: body.ticker.toUpperCase(),
        side: body.side,
        request: JSON.stringify(body),
      },
    }).catch(() => null)

    const order = await alpaca.placeOrder({
      symbol: body.ticker.toUpperCase(),
      side: body.side,
      type: body.type,
      time_in_force: body.type === 'market' ? 'day' : 'gtc',
      client_order_id: body.clientOrderId,
      ...(body.qty && { qty: String(body.qty) }),
      ...(body.notional && { notional: String(body.notional) }),
      ...(body.limitPrice && { limit_price: String(body.limitPrice) }),
      ...(body.extendedHours && { extended_hours: true }),
    })

    // Update audit with result
    if (audit) {
      await prisma.orderAudit.update({
        where: { id: audit.id },
        data: { alpacaOrderId: order.id, status: order.status, filledQty: order.filled_qty ?? null, filledPrice: order.filled_avg_price ?? null },
      }).catch(() => {})
    }

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

        await prisma.$transaction([
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

    if (order.status === 'filled') {
      const side = body.side === 'buy' ? '매수' : '매도'
      await sendPushNotification(
        `${order.symbol} 주문 체결`,
        `${order.symbol} ${order.filled_qty}주 ${side} 체결 @ $${order.filled_avg_price ?? '?'}`
      ).catch(() => {})
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Order failed'
    if (audit) {
      await prisma.orderAudit.update({
        where: { id: audit.id },
        data: { error: message },
      }).catch(() => {})
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
