import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

export const runtime = 'nodejs'

const PUBLIC_PATHS = ['/login', '/api/login']
const SESSION_COOKIE = 'session'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }
  const session = req.cookies.get(SESSION_COOKIE)?.value
  if (!verifySession(session)) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
