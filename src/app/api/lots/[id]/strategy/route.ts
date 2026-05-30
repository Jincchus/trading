import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { strategyId: string | null }
    const lot = await prisma.lot.update({
      where: { id },
      data: { strategyId: body.strategyId },
    })
    return NextResponse.json({ lot })
  } catch {
    return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
  }
}
