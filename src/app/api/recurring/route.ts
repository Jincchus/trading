import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

export async function GET() {
  const recurring = await prisma.recurringInvestment.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ recurring })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticker?: string; amount?: number; frequency?: string }
    if (!body.ticker?.trim()) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })
    if (!body.amount || body.amount <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    if (!VALID_FREQUENCIES.includes(body.frequency as typeof VALID_FREQUENCIES[number])) {
      return NextResponse.json({ error: 'frequency must be daily, weekly, or monthly' }, { status: 400 })
    }
    const recurring = await prisma.recurringInvestment.create({
      data: { ticker: body.ticker.trim().toUpperCase(), amount: body.amount, frequency: body.frequency! },
    })
    return NextResponse.json({ recurring }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
