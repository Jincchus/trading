import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const [alpacaPositions, dbLots, stockCategories] = await Promise.all([
      alpaca.getPositions(),
      prisma.lot.findMany({ where: { status: 'active' } }),
      prisma.stockCategory.findMany({ include: { category: true } }),
    ])

    const lotsByTicker = new Map<string, typeof dbLots>()
    for (const lot of dbLots) {
      if (!lotsByTicker.has(lot.ticker)) lotsByTicker.set(lot.ticker, [])
      lotsByTicker.get(lot.ticker)!.push(lot)
    }

    const categoryNamesByTicker = new Map<string, string[]>()
    for (const sc of stockCategories) {
      if (!categoryNamesByTicker.has(sc.ticker)) categoryNamesByTicker.set(sc.ticker, [])
      categoryNamesByTicker.get(sc.ticker)!.push(sc.category.name)
    }

    const positions = alpacaPositions.map((pos) => {
      const currentPrice = parseFloat(pos.current_price)
      const qty = parseFloat(pos.qty)

      const lots = (lotsByTicker.get(pos.symbol) ?? []).map((lot) => {
        const remaining = lot.quantity - lot.soldQuantity
        const pl = (currentPrice - lot.purchasePrice) * remaining
        const plPct = lot.purchasePrice > 0
          ? ((currentPrice - lot.purchasePrice) / lot.purchasePrice) * 100
          : 0
        return {
          id: lot.id,
          quantity: lot.quantity,
          remainingQty: remaining,
          purchasePrice: lot.purchasePrice,
          purchaseDate: lot.purchaseDate.toISOString(),
          currentValue: remaining * currentPrice,
          unrealizedPL: pl,
          unrealizedPLPct: plPct,
          status: lot.status,
          strategyId: lot.strategyId,
        }
      })

      return {
        ticker: pos.symbol,
        qty,
        currentPrice,
        currentValue: qty * currentPrice,
        unrealizedPL: parseFloat(pos.unrealized_pl),
        unrealizedPLPct: parseFloat(pos.unrealized_plpc) * 100,
        lots,
        categories: categoryNamesByTicker.get(pos.symbol) ?? [],
      }
    })

    const totalValue = positions.reduce((s, p) => s + p.currentValue, 0)
    const totalUnrealizedPL = positions.reduce((s, p) => s + p.unrealizedPL, 0)

    return NextResponse.json({ positions, totalValue, totalUnrealizedPL })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch portfolio'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
