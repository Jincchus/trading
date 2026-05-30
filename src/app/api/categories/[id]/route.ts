import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { name?: string; color?: string }
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.color && { color: body.color }),
      },
    })
    return NextResponse.json({ category })
  } catch {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }
}
