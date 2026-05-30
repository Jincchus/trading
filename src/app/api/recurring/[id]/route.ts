import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { amount?: number; frequency?: string; active?: boolean }
    const recurring = await prisma.recurringInvestment.update({
      where: { id },
      data: {
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.frequency && { frequency: body.frequency }),
        ...(body.active !== undefined && { active: body.active }),
      },
    })
    return NextResponse.json({ recurring })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.recurringInvestment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
