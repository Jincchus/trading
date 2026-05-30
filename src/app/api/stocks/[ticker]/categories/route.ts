import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const assignments = await prisma.stockCategory.findMany({
    where: { ticker: ticker.toUpperCase() },
    include: { category: true },
  })
  return NextResponse.json({ categories: assignments.map((a) => a.category) })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const { categoryId } = await req.json() as { categoryId: string }
    await prisma.stockCategory.create({
      data: { ticker: ticker.toUpperCase(), categoryId },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Assignment already exists or invalid' }, { status: 409 })
  }
}
