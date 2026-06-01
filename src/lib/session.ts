import { createHmac, timingSafeEqual } from 'crypto'

// Sessions are valid for 30 days, then must be re-issued via login.
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000

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

  // Payload must be `auth.<unix-ms>` — reject anything else.
  const m = payload.match(/^auth\.(\d+)$/)
  if (!m) return false
  const issuedAt = Number(m[1])
  if (!Number.isFinite(issuedAt)) return false

  // Reject expired (and clock-skewed future) tokens.
  const age = Date.now() - issuedAt
  if (age < 0 || age > SESSION_MAX_AGE_MS) return false

  // Compare signatures as fixed-length hex strings to avoid Buffer.from(_, 'hex')
  // silently truncating at the first invalid character.
  const expected = createHmac('sha256', getSecret()).update(payload).digest('hex')
  if (sig.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}
