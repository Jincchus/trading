import { prisma } from './db'
import { alpaca } from './alpaca/client'
import { sendPushNotification } from './push'

export async function checkAlerts(): Promise<void> {
  const alerts = await prisma.alert.findMany({ where: { active: true } })
  if (alerts.length === 0) return

  const positions = await alpaca.getPositions()
  const priceMap = new Map(positions.map((p) => [p.symbol, parseFloat(p.current_price)]))

  for (const alert of alerts) {
    const currentPrice = priceMap.get(alert.ticker)
    if (!currentPrice) continue

    const triggered =
      (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
      (alert.direction === 'below' && currentPrice <= alert.targetPrice)

    if (!triggered) continue

    await sendPushNotification(
      `${alert.ticker} 목표가 도달`,
      `${alert.ticker}가 $${currentPrice.toFixed(2)}에 도달했습니다 (목표: $${alert.targetPrice.toFixed(2)})`
    )

    await prisma.$transaction([
      prisma.alertHistory.create({
        data: { alertId: alert.id, price: currentPrice },
      }),
      prisma.alert.update({
        where: { id: alert.id },
        data: { active: false },
      }),
    ])
  }
}
