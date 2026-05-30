import { NextRequest, NextResponse } from 'next/server'
import { parseWiseCsv } from '@/lib/wise-parser'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const entries = parseWiseCsv(text)

    let created = 0
    for (const entry of entries) {
      const existing = await prisma.fxRecord.findFirst({
        where: {
          source: 'wise',
          date: entry.date,
          krwAmount: entry.krwAmount,
          usdAmount: entry.usdAmount,
        },
      })
      if (!existing) {
        await prisma.fxRecord.create({ data: entry })
        created++
      }
    }

    return NextResponse.json({ parsed: entries.length, created })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
