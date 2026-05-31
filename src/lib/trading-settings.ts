import { prisma } from './db'

export async function isTradingEnabled(): Promise<boolean> {
  const s = await prisma.tradingSettings.upsert({
    where: { id: 1 },
    create: { id: 1, tradingEnabled: true },
    update: {},
  })
  return s.tradingEnabled
}

export async function setTradingEnabled(enabled: boolean): Promise<void> {
  await prisma.tradingSettings.upsert({
    where: { id: 1 },
    create: { id: 1, tradingEnabled: enabled },
    update: { tradingEnabled: enabled },
  })
}
