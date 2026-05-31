import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { signSession } from '@/lib/session'

const SESSION_COOKIE = 'session'
const MAX_AGE = 60 * 60 * 24 * 30

// In-memory rate limiter: max 5 attempts per IP per minute
const attempts = new Map<string, { count: number; resetAt: number }>()
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  if (isRateLimited(ip)) {
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
