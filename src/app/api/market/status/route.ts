import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

type Session = 'pre' | 'regular' | 'after' | 'closed'

interface ClockResponse {
  timestamp: string
  is_open: boolean
  next_open: string
  next_close: string
}

function detectSession(timestamp: string, isOpen: boolean): Session {
  if (isOpen) return 'regular'

  // timestamp format: 2024-01-15T09:20:00.000000000-05:00
  // 앞 19자만 파싱 (ET 시간)
  const etHour = parseInt(timestamp.slice(11, 13), 10)
  const etMin  = parseInt(timestamp.slice(14, 16), 10)
  const total  = etHour * 60 + etMin

  // Pre-market: 04:00 ~ 09:30 ET
  if (total >= 4 * 60 && total < 9 * 60 + 30) return 'pre'

  // After-market: 16:00 ~ 20:00 ET
  if (total >= 16 * 60 && total < 20 * 60) return 'after'

  return 'closed'
}

const SESSION_META: Record<Session, {
  label: string
  color: string
  extendedHours: boolean
  allowFractional: boolean
  allowMarket: boolean
}> = {
  regular: { label: '정규장',     color: 'red',   extendedHours: false, allowFractional: true,  allowMarket: true  },
  pre:     { label: '프리마켓',   color: 'amber', extendedHours: true,  allowFractional: false, allowMarket: false },
  after:   { label: '애프터마켓', color: 'amber', extendedHours: true,  allowFractional: false, allowMarket: false },
  closed:  { label: '장 마감',    color: 'gray',  extendedHours: false, allowFractional: true,  allowMarket: false },
}

export async function GET() {
  try {
    const res = await fetch(`${env.ALPACA_BASE_URL}/v2/clock`, {
      headers: {
        'APCA-API-KEY-ID': env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET,
      },
      next: { revalidate: 30 },
    })
    if (!res.ok) throw new Error('clock API failed')

    const clock = await res.json() as ClockResponse
    const session = detectSession(clock.timestamp, clock.is_open)

    return NextResponse.json({
      session,
      isOpen: clock.is_open,
      nextOpen: clock.next_open,
      ...SESSION_META[session],
    })
  } catch {
    return NextResponse.json({
      session: 'closed' as Session,
      isOpen: false,
      nextOpen: null,
      ...SESSION_META.closed,
    })
  }
}
