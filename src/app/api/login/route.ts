import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

const SESSION_COOKIE = 'session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30일

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string }

  if (!password || password !== env.APP_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, 'authenticated', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
    // 배포 HTTPS 환경에서는 secure: true 로 변경 권장
  })
  return res
}
