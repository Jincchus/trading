'use client'

import { useEffect, useRef, useState } from 'react'

export interface RealtimePrice {
  price: number
  timestamp: string
}

export function useRealtimePrice(ticker: string): RealtimePrice | null {
  const [latest, setLatest] = useState<RealtimePrice | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'subscribe', ticker }))
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          ticker: string
          price: number
          timestamp: string
        }
        if (msg.ticker === ticker) {
          setLatest({ price: msg.price, timestamp: msg.timestamp })
        }
      } catch {}
    }

    return () => ws.close()
  }, [ticker])

  return latest
}
