import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; color?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const category = await prisma.category.create({
      data: { name: body.name.trim(), color: body.color ?? '#3b82f6' },
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create category'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
