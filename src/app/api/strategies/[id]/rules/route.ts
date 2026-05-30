import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { threshold?: number; sellPct?: number }

    if (body.threshold === undefined || body.sellPct === undefined) {
      return NextResponse.json({ error: 'threshold and sellPct required' }, { status: 400 })
    }
    if (body.sellPct <= 0 || body.sellPct > 100) {
      return NextResponse.json({ error: 'sellPct must be between 1 and 100' }, { status: 400 })
    }

    const rule = await prisma.strategyRule.create({
      data: { strategyId: id, threshold: body.threshold, sellPct: body.sellPct },
    })
    return NextResponse.json({ rule }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
