import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function GET() {
  const account = await alpaca.getAccount()
  return NextResponse.json(account)
}
