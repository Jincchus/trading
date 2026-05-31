import { prisma } from './db'
import { alpaca } from './alpaca/client'
import { sendPushNotification } from './push'

export async function checkStrategies(): Promise<void> {
  // Only run during market hours
  const clock = await alpaca.getClock().catch(() => null)
  if (!clock?.is_open) return

  const lots = await prisma.lot.findMany({
    where: { status: 'active', strategyId: { not: null } },
    include: { strategy: { include: { rules: { orderBy: { threshold: 'asc' } } } } },
  })
  if (lots.length === 0) return

  const [positions, openOrders] = await Promise.all([
    alpaca.getPositions(),
    alpaca.getOrders({ status: 'open', limit: 100 }),
  ])

  const priceMap = new Map(positions.map((p) => [p.symbol, parseFloat(p.current_price)]))
  // Tickers with existing open sell orders — skip to avoid duplicate selling
  const pendingTickers = new Set(
    openOrders.filter((o) => o.side === 'sell').map((o) => o.symbol)
  )

  for (const lot of lots) {
    if (!lot.strategy) continue
    if (pendingTickers.has(lot.ticker)) continue

    const currentPrice = priceMap.get(lot.ticker)
    if (!currentPrice) continue

    const plPct = ((currentPrice - lot.purchasePrice) / lot.purchasePrice) * 100

    for (const rule of lot.strategy.rules) {
      // Re-read soldQuantity from DB to get latest value (including optimistic updates from other runs)
      const freshLot = await prisma.lot.findUnique({ where: { id: lot.id } })
      if (!freshLot || freshLot.status !== 'active') break

      const currentSold = freshLot.soldQuantity
      if (plPct < rule.threshold) continue

      const targetCumulative = freshLot.quantity * (rule.sellPct / 100)
      if (targetCumulative <= currentSold) continue

      const qtyToSell = parseFloat((targetCumulative - currentSold).toFixed(6))
      if (qtyToSell <= 0) continue

      // Optimistic update: increment soldQuantity BEFORE placing order
      // This prevents duplicate sells if the scheduler ticks again before fill
      try {
        const newSold = currentSold + qtyToSell
        await prisma.lot.update({
          where: { id: lot.id },
          data: {
            soldQuantity: newSold,
            status: newSold >= freshLot.quantity ? 'fully_sold' : 'active',
          },
        })
      } catch (e) {
        console.error(`[Strategy] Failed to optimistic-update lot ${lot.id}:`, e)
        break
      }

      try {
        const order = await alpaca.placeOrder({
          symbol: lot.ticker,
          qty: String(qtyToSell),
          side: 'sell',
          type: 'market',
          time_in_force: 'day',
        })

        console.log(`[Strategy] Queued ${qtyToSell} ${lot.ticker} sell (+${rule.threshold}% rule) order=${order.id}`)
        pendingTickers.add(lot.ticker)

        await sendPushNotification(
          `[전략] ${lot.ticker} 자동 매도 주문`,
          `${lot.ticker} ${qtyToSell}주 매도 주문 (+${rule.threshold}% 룰)`
        ).catch(() => {})
        break // One rule per lot per tick
      } catch (e) {
        // Rollback optimistic update on order failure
        console.error(`[Strategy] Order failed for ${lot.ticker}, rolling back:`, e)
        const freshLot2 = await prisma.lot.findUnique({ where: { id: lot.id } })
        if (freshLot2) {
          await prisma.lot.update({
            where: { id: lot.id },
            data: { soldQuantity: currentSold, status: 'active' },
          }).catch(() => {})
        }
        break
      }
    }
  }
}
