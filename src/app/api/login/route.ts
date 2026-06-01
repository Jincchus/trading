import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { signSession, SESSION_MAX_AGE_MS } from '@/lib/session'
import { createRateLimiter, clientIp } from '@/lib/rate-limit'

const SESSION_COOKIE = 'session'
const MAX_AGE = SESSION_MAX_AGE_MS / 1000

// Max 5 attempts per IP per minute
const limiter = createRateLimiter(5, 60_000)

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers.get('x-forwarded-for'), req.headers.get('x-real-ip'))
  if (limiter.check(ip)) {
    return NextResponse.json({ error: '너무 많은 시도. 잠시 후 다시 시도하세요.' }, { status: 429 })
  }

  const expected = process.env.APP_PASSWORD ?? ''
  const body = await req.json() as { password?: string }
  const input = body.password ?? ''

  const len = Math.max(expected.length, input.length, 1)
  const a = Buffer.alloc(len); Buffer.from(expected).copy(a)
  const b = Buffer.alloc(len); Buffer.from(input).copy(b)
  const match = timingSafeEqual(a, b) && input.length === expected.length

  if (!match) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, signSession(), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
