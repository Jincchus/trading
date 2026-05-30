import { env } from './env'

export async function getCurrentKrwRate(): Promise<number> {
  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${env.EXCHANGE_RATE_API_KEY}/latest/USD`
    )
    if (!res.ok) return 1300
    const data = await res.json() as { conversion_rates?: { KRW?: number } }
    return data.conversion_rates?.KRW ?? 1300
  } catch {
    return 1300
  }
}
