import { prisma } from './db'
import { alpaca } from './alpaca/client'
import { shouldRun } from './recurring'
import { isTradingEnabled } from './trading-settings'

/**
 * Executes due recurring investments. Mirrors the manual order path: every buy
 * carries a client_order_id (broker-side idempotency), is recorded in
 * OrderAudit, and creates a Lot when it fills immediately. lastRun is advanced
 * optimistically before the order is placed — and rolled back on failure — so a
 * hang or restart cannot trigger a duplicate buy on the next tick.
 */
export async function runRecurringInvestments(now: Date = new Date()): Promise<void> {
  if (!(await isTradingEnabled())) return

  const actives = await prisma.recurringInvestment.findMany({ where: { active: true } })
  for (const ri of actives) {
    if (!shouldRun(ri.frequency, ri.lastRun, now)) continue

    const ticker = ri.ticker.toUpperCase()
    const clientOrderId = crypto.randomUUID()
    const prevLastRun = ri.lastRun

    // Optimistic advance to prevent double-fire on the next tick.
    await prisma.recurringInvestment.update({ where: { id: ri.id }, data: { lastRun: now } })

    const audit = await prisma.orderAudit.create({
      data: {
        source: 'recurring',
        clientOrderId,
        ticker,
        side: 'buy',
        request: JSON.stringify({ ticker, notional: ri.amount, frequency: ri.frequency }),
      },
    }).catch(() => null)

    try {
      const order = await alpaca.placeOrder({
        symbol: ticker,
        notional: String(ri.amount),
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
        client_order_id: clientOrderId,
      })

      if (audit) {
        await prisma.orderAudit.update({
          where: { id: audit.id },
          data: {
            alpacaOrderId: order.id,
            status: order.status,
            filledQty: order.filled_qty ?? null,
            filledPrice: order.filled_avg_price ?? null,
          },
        }).catch(() => {})
      }

      if (order.status === 'filled' && order.filled_avg_price && order.filled_qty && order.filled_at) {
        await prisma.lot.create({
          data: {
            ticker,
            quantity: parseFloat(order.filled_qty),
            purchasePrice: parseFloat(order.filled_avg_price),
            purchaseDate: new Date(order.filled_at),
            alpacaOrderId: order.id,
          },
        }).catch(() => {})
      }

      console.log(`[Recurring] $${ri.amount} → ${ticker} (${order.status})`)
    } catch (e) {
      // Roll back so the next eligible tick retries.
      await prisma.recurringInvestment
        .update({ where: { id: ri.id }, data: { lastRun: prevLastRun } })
        .catch(() => {})
      if (audit) {
        await prisma.orderAudit
          .update({ where: { id: audit.id }, data: { error: e instanceof Error ? e.message : String(e) } })
          .catch(() => {})
      }
      console.error(`[Recurring] Failed for ${ticker}:`, e)
    }
  }
}
