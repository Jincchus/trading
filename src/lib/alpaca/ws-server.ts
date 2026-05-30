import WebSocket from 'ws'

export interface PriceUpdate {
  ticker: string
  price: number
  timestamp: string
}

interface Config {
  apiKey: string
  apiSecret: string
  wsUrl: string
}

export function buildWsManager(config: Config) {
  const browserClients = new Set<WebSocket>()
  const subscribedTickers = new Set<string>()
  let alpacaWs: WebSocket | null = null
  let isAuthenticated = false

  function broadcast(update: PriceUpdate) {
    const msg = JSON.stringify(update)
    for (const client of browserClients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    }
  }

  function sendSubscribe() {
    if (isAuthenticated && alpacaWs?.readyState === WebSocket.OPEN && subscribedTickers.size > 0) {
      alpacaWs.send(JSON.stringify({ action: 'subscribe', trades: Array.from(subscribedTickers) }))
    }
  }

  function connect() {
    isAuthenticated = false
    alpacaWs = new WebSocket(config.wsUrl)
    alpacaWs.on('open', () => {
      alpacaWs!.send(JSON.stringify({ action: 'auth', key: config.apiKey, secret: config.apiSecret }))
    })
    alpacaWs.on('message', (data: Buffer) => {
      try {
        const msgs = JSON.parse(data.toString()) as Array<{ T: string; S: string; p: number; t: string }>
        for (const msg of msgs) {
          if (msg.T === 'authenticated') {
            isAuthenticated = true
            sendSubscribe()
          }
          if (msg.T === 't') broadcast({ ticker: msg.S, price: msg.p, timestamp: msg.t })
        }
      } catch {
        // malformed message — ignore
      }
    })
    alpacaWs.on('close', () => setTimeout(connect, 5000))
    alpacaWs.on('error', (err) => {
      console.error('[WS] Alpaca connection error:', err.message)
    })
  }

  return {
    connect,
    registerBrowserClient(ws: WebSocket) {
      browserClients.add(ws)
      ws.on('close', () => browserClients.delete(ws))
    },
    subscribeTicker(ticker: string) {
      if (subscribedTickers.has(ticker)) return
      subscribedTickers.add(ticker)
      sendSubscribe()
    },
    getSubscribedTickers: () => Array.from(subscribedTickers),
    broadcastForTest: broadcast,
    disconnect() {
      if (alpacaWs) {
        alpacaWs.removeAllListeners('close')
        alpacaWs.close()
        alpacaWs = null
      }
      for (const client of browserClients) {
        client.close()
      }
      browserClients.clear()
    },
  }
}
