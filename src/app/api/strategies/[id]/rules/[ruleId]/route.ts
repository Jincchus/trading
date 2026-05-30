import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const { ruleId } = await params
    await prisma.strategyRule.delete({ where: { id: ruleId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }
}
