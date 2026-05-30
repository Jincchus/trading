import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string; categoryId: string }> }
) {
  try {
    const { ticker, categoryId } = await params
    await prisma.stockCategory.delete({
      where: { ticker_categoryId: { ticker: ticker.toUpperCase(), categoryId } },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }
}
