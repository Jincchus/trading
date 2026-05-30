import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const records = await prisma.fxRecord.findMany({ orderBy: { date: 'desc' } })
  return NextResponse.json({ records })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { date?: string; krwAmount?: number; usdAmount?: number }
    if (!body.date || !body.krwAmount || !body.usdAmount) {
      return NextResponse.json({ error: 'date, krwAmount, usdAmount required' }, { status: 400 })
    }
    if (body.krwAmount <= 0 || body.usdAmount <= 0) {
      return NextResponse.json({ error: 'Amounts must be positive' }, { status: 400 })
    }
    const record = await prisma.fxRecord.create({
      data: {
        date: new Date(body.date),
        krwAmount: body.krwAmount,
        usdAmount: body.usdAmount,
        exchangeRate: body.krwAmount / body.usdAmount,
        source: 'manual',
      },
    })
    return NextResponse.json({ record }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
