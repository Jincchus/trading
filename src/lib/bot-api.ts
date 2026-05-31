export const BOT_API = '/api/bot'

export interface Strategy {
  id: number
  name: string
  strategy_type: string
  budget: string
  status: 'running' | 'stopped' | 'failed'
  run_interval: string
  created_at: string
}
export interface PortfolioPoint {
  id: number; timestamp: string; equity: string; cash: string; unrealized_pnl: string
}
export interface Performance {
  id: number; date: string; total_value: string; daily_return: string
  win_rate: string | null; sharpe_ratio: string | null; drawdown: string | null
}
export interface Trade {
  id: number; symbol: string; side: 'buy' | 'sell'; qty: string; price: string
  alpaca_order_id: string; filled_at: string
}
export interface Position {
  symbol: string; qty: string; avg_entry_price: string; current_price: string | null
  unrealized_pl: string; unrealized_plpc: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BOT_API}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}
async function post(path: string): Promise<void> {
  const res = await fetch(`${BOT_API}${path}`, { method: 'POST' })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
}

export const getStrategies = () => get<Strategy[]>('/strategies')
export const getPortfolio = (id: number) => get<PortfolioPoint[]>(`/strategies/${id}/portfolio`)
export const getPerformance = (id: number) => get<Performance[]>(`/strategies/${id}/performance`)
export const getTrades = (id: number) => get<Trade[]>(`/strategies/${id}/trades`)
export const getPositions = (id: number) => get<Position[]>(`/strategies/${id}/positions`)
export const startStrategy = (id: number) => post(`/strategies/${id}/start`)
export const stopStrategy = (id: number) => post(`/strategies/${id}/stop`)
