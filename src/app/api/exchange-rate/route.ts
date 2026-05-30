import { NextResponse } from 'next/server'
import { getCurrentKrwRate } from '@/lib/exchange-rate'

export async function GET() {
  const rate = await getCurrentKrwRate()
  return NextResponse.json({ rate, base: 'USD', target: 'KRW' })
}
