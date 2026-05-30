export interface AlpacaAccount {
  buying_power: string
  cash: string
  portfolio_value: string
  equity: string
}

export interface AlpacaPosition {
  symbol: string
  qty: string
  avg_entry_price: string
  current_price: string
  unrealized_pl: string
  unrealized_plpc: string
}

export interface AlpacaOrder {
  id: string
  symbol: string
  qty: string
  filled_qty: string
  type: string
  side: string
  status: string
  filled_at: string | null
  filled_avg_price: string | null
  extended_hours: boolean
}

interface ClientConfig {
  ALPACA_API_KEY: string
  ALPACA_API_SECRET: string
  ALPACA_BASE_URL: string
}

export function buildAlpacaClient(config: ClientConfig) {
  async function req(path: string, options?: RequestInit) {
    const res = await fetch(`${config.ALPACA_BASE_URL}${path}`, {
      ...options,
      headers: {
        'APCA-API-KEY-ID': config.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': config.ALPACA_API_SECRET,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    if (!res.ok) {
      let msg = `Alpaca API error: ${res.status}`
      try {
        const err = await res.json()
        if (err.message) msg += ` — ${err.message}`
      } catch {}
      throw new Error(msg)
    }
    return res.json()
  }

  return {
    getAccount: (): Promise<AlpacaAccount> => req('/v2/account'),
    getPositions: (): Promise<AlpacaPosition[]> => req('/v2/positions'),
    getOrders: (params?: { status?: string; limit?: number }): Promise<AlpacaOrder[]> => {
      const qs = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return req(`/v2/orders${qs ? `?${qs}` : ''}`)
    },
    placeOrder: (order: {
      symbol: string
      qty?: string
      notional?: string
      side: 'buy' | 'sell'
      type: 'market' | 'limit' | 'stop' | 'stop_limit'
      time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok'
      limit_price?: string
      stop_price?: string
      extended_hours?: boolean
    }): Promise<AlpacaOrder> =>
      req('/v2/orders', { method: 'POST', body: JSON.stringify(order) }),
    cancelOrder: (orderId: string): Promise<void> =>
      req(`/v2/orders/${orderId}`, { method: 'DELETE' }),
  }
}

import { env } from '../env'
export const alpaca = buildAlpacaClient(env)
