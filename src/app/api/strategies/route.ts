import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const strategies = await prisma.strategy.findMany({
    include: { rules: { orderBy: { threshold: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ strategies })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const strategy = await prisma.strategy.create({
      data: { name: body.name.trim() },
      include: { rules: true },
    })
    return NextResponse.json({ strategy }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
