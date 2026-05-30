import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.fxRecord.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
