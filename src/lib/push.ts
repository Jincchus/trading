import webpush from 'web-push'
import { env } from './env'
import { getPushSubscription } from './push-store'

webpush.setVapidDetails(
  `mailto:${env.VAPID_EMAIL}`,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
)

export async function sendPushNotification(title: string, body: string): Promise<void> {
  const sub = getPushSubscription()
  if (!sub) return
  try {
    await webpush.sendNotification(
      sub as webpush.PushSubscription,
      JSON.stringify({ title, body })
    )
  } catch (e) {
    console.error('[Push] Failed:', e)
  }
}
