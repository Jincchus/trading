const DAY_MS = 24 * 60 * 60 * 1000

export function shouldRun(frequency: string, lastRun: Date | null, now: Date): boolean {
  const isValidFrequency = ['daily', 'weekly', 'monthly'].includes(frequency)
  if (!isValidFrequency) return false
  if (!lastRun) return true
  const elapsed = now.getTime() - lastRun.getTime()
  switch (frequency) {
    case 'daily': return elapsed >= DAY_MS
    case 'weekly': return elapsed >= 7 * DAY_MS
    case 'monthly': return elapsed >= 30 * DAY_MS
    default: return false
  }
}
