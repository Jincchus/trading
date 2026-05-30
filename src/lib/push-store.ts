import fs from 'fs'
import path from 'path'

const STORE_PATH = path.join(process.cwd(), 'data', 'push-subscription.json')

export function savePushSubscription(sub: object): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  fs.writeFileSync(STORE_PATH, JSON.stringify(sub, null, 2))
}

export function getPushSubscription(): object | null {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

export function deletePushSubscription(): void {
  try { fs.unlinkSync(STORE_PATH) } catch {}
}
