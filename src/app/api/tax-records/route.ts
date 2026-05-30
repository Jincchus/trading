import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const EXEMPTION_KRW = 2_500_000
const TAX_RATE = 0.22

export async function GET() {
  const records = await prisma.taxRecord.findMany({ orderBy: { saleDate: 'desc' } })
  const totalGainKrw = records.reduce((s, r) => s + r.gainKrw, 0)
  const taxableGainKrw = Math.max(0, totalGainKrw - EXEMPTION_KRW)
  const estimatedTaxKrw = Math.round(taxableGainKrw * TAX_RATE)

  return NextResponse.json({ records, totalGainKrw, taxableGainKrw, estimatedTaxKrw, exemptionKrw: EXEMPTION_KRW })
}
