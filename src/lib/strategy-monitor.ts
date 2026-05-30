import { prisma } from './db'
import { alpaca } from './alpaca/client'
import { sendPushNotification } from './push'

export async function checkStrategies(): Promise<void> {
  const lots = await prisma.lot.findMany({
    where: { status: 'active', strategyId: { not: null } },
    include: {
      strategy: {
        include: { rules: { orderBy: { threshold: 'asc' } } },
      },
    },
  })

  if (lots.length === 0) return

  const positions = await alpaca.getPositions()
  const priceMap = new Map(
    positions.map((p) => [p.symbol, parseFloat(p.current_price)])
  )

  for (const lot of lots) {
    if (!lot.strategy) continue
    const currentPrice = priceMap.get(lot.ticker)
    if (!currentPrice) continue

    const plPct = ((currentPrice - lot.purchasePrice) / lot.purchasePrice) * 100
    let currentSold = lot.soldQuantity

    for (const rule of lot.strategy.rules) {
      if (plPct < rule.threshold) continue

      const targetCumulative = lot.quantity * (rule.sellPct / 100)
      if (targetCumulative <= currentSold) continue

      const qtyToSell = parseFloat((targetCumulative - currentSold).toFixed(6))
      if (qtyToSell <= 0) continue

      try {
        const order = await alpaca.placeOrder({
          symbol: lot.ticker,
          qty: String(qtyToSell),
          side: 'sell',
          type: 'market',
          time_in_force: 'day',
        })

        if (order.status === 'filled' && order.filled_qty) {
          currentSold += parseFloat(order.filled_qty)
          console.log(`[Strategy] Sold ${order.filled_qty} ${lot.ticker} (+${rule.threshold}% rule)`)
          await sendPushNotification(
            `[전략] ${lot.ticker} 자동 매도`,
            `${lot.ticker} ${order.filled_qty}주를 $${order.filled_avg_price ?? '?'}에 자동 매도 (+${rule.threshold}% 룰)`
          )
        }
      } catch (e) {
        console.error(`[Strategy] Failed for ${lot.ticker}:`, e)
      }
    }

    if (currentSold !== lot.soldQuantity) {
      await prisma.lot.update({
        where: { id: lot.id },
        data: {
          soldQuantity: currentSold,
          status: currentSold >= lot.quantity ? 'fully_sold' : 'active',
        },
      })
    }
  }
}
