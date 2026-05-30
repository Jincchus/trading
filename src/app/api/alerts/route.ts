import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const showHistory = req.nextUrl.searchParams.get('history') === 'true'

  if (showHistory) {
    const history = await prisma.alertHistory.findMany({
      include: { alert: true },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ history })
  }

  const alerts = await prisma.alert.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ alerts })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticker?: string; targetPrice?: number; direction?: string }
    if (!body.ticker?.trim() || !body.targetPrice || !body.direction) {
      return NextResponse.json({ error: 'ticker, targetPrice, direction required' }, { status: 400 })
    }
    if (!['above', 'below'].includes(body.direction)) {
      return NextResponse.json({ error: 'direction must be "above" or "below"' }, { status: 400 })
    }
    const alert = await prisma.alert.create({
      data: {
        ticker: body.ticker.trim().toUpperCase(),
        targetPrice: body.targetPrice,
        direction: body.direction,
      },
    })
    return NextResponse.json({ alert }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
