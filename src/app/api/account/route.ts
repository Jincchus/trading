import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function GET() {
  try {
    const account = await alpaca.getAccount()
    return NextResponse.json(account)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch account'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
