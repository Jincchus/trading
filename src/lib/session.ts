import { createHmac, timingSafeEqual } from 'crypto'

function getSecret(): string {
  const s = process.env.SESSION_SECRET ?? ''
  if (s.length < 32) throw new Error('SESSION_SECRET missing or too short (min 32 chars)')
  return s
}

export function signSession(): string {
  const payload = `auth.${Date.now()}`
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifySession(token?: string): boolean {
  if (!token) return false
  const i = token.lastIndexOf('.')
  if (i < 0) return false
  const payload = token.slice(0, i)
  const sig = token.slice(i + 1)
  try {
    const expected = createHmac('sha256', getSecret()).update(payload).digest('hex')
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  } catch { return false }
}
