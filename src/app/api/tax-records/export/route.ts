import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

const EXEMPTION_KRW = 2_500_000
const TAX_RATE = 0.22

export async function GET() {
  const records = await prisma.taxRecord.findMany({ orderBy: { saleDate: 'asc' } })

  const headers = [
    '종목', '취득일', '취득가(USD)', '취득환율(₩/$)', '취득가(KRW)',
    '양도일', '양도가(USD)', '양도환율(₩/$)', '양도가(KRW)', '수량', '양도차익(KRW)',
  ]

  const rows = records.map((r) => [
    r.ticker,
    r.acquireDate.toISOString().slice(0, 10),
    r.acquirePrice,
    r.acquireRate,
    Math.round(r.acquirePrice * r.acquireRate),
    r.saleDate.toISOString().slice(0, 10),
    r.salePrice,
    r.saleRate,
    Math.round(r.salePrice * r.saleRate),
    r.quantity,
    Math.round(r.gainKrw),
  ])

  const totalGainKrw = records.reduce((s, r) => s + r.gainKrw, 0)
  const taxableGainKrw = Math.max(0, totalGainKrw - EXEMPTION_KRW)

  const summaryRows = [
    [],
    ['합계 양도차익', '', '', '', '', '', '', '', '', '', Math.round(totalGainKrw)],
    ['기본공제', '', '', '', '', '', '', '', '', '', -EXEMPTION_KRW],
    ['과세표준', '', '', '', '', '', '', '', '', '', Math.round(taxableGainKrw)],
    ['세율', '', '', '', '', '', '', '', '', '', '22%'],
    ['납부세액(예상)', '', '', '', '', '', '', '', '', '', Math.round(taxableGainKrw * TAX_RATE)],
  ]

  const wsData = [headers, ...rows, ...summaryRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = headers.map(() => ({ wch: 16 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '양도소득세')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tax-${new Date().getFullYear()}.xlsx"`,
    },
  })
}
