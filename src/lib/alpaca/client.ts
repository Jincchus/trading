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

export interface AlpacaBar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface AlpacaQuote {
  t: string
  ap: number
  as: number
  bp: number
  bs: number
}

export interface AlpacaTrade {
  t: string
  p: number
  s: number
}

export interface AlpacaActivity {
  id: string
  activity_type: string
  date: string
  net_amount: string
  symbol: string
  description: string
}

interface ClientConfig {
  ALPACA_API_KEY: string
  ALPACA_API_SECRET: string
  ALPACA_BASE_URL: string
  ALPACA_DATA_URL: string
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

  async function dataReq(path: string, params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await fetch(`${config.ALPACA_DATA_URL}${path}${qs}`, {
      headers: {
        'APCA-API-KEY-ID': config.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': config.ALPACA_API_SECRET,
      },
    })
    if (!res.ok) {
      let msg = `Alpaca Data API error: ${res.status}`
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
    getOrders: (params?: { status?: string; limit?: number; side?: 'buy' | 'sell' }): Promise<AlpacaOrder[]> => {
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
      client_order_id?: string
    }): Promise<AlpacaOrder> =>
      req('/v2/orders', { method: 'POST', body: JSON.stringify(order) }),
    cancelOrder: (orderId: string): Promise<void> =>
      req(`/v2/orders/${orderId}`, { method: 'DELETE' }),
    getBars: (
      symbol: string,
      params: {
        timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day' | '1Week' | '1Month'
        start?: string
        end?: string
        limit?: number
        feed?: 'iex' | 'sip'
      }
    ): Promise<{ bars: AlpacaBar[] }> =>
      dataReq(`/v2/stocks/${symbol}/bars`, {
        timeframe: params.timeframe,
        ...(params.start && { start: params.start }),
        ...(params.end && { end: params.end }),
        ...(params.limit && { limit: String(params.limit) }),
        feed: params.feed ?? 'iex',
      }),
    getLatestQuote: (symbol: string): Promise<{ quote: AlpacaQuote }> =>
      dataReq(`/v2/stocks/${symbol}/quotes/latest`, { feed: 'iex' }),
    getLatestTrade: (symbol: string): Promise<{ trade: AlpacaTrade }> =>
      dataReq(`/v2/stocks/${symbol}/trades/latest`, { feed: 'iex' }),
    getActivities: (params?: { activity_type?: string }): Promise<AlpacaActivity[]> => {
      const qs = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return req(`/v2/account/activities${qs ? `?${qs}` : ''}`)
    },
    getClock: (): Promise<{ is_open: boolean; next_open: string; next_close: string }> =>
      req('/v2/clock'),
  }
}

import { env, ALPACA_BASE_URL } from '../env'
export const alpaca = buildAlpacaClient({ ...env, ALPACA_BASE_URL })
