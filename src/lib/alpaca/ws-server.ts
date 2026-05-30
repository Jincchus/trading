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

  function broadcast(update: PriceUpdate) {
    const msg = JSON.stringify(update)
    for (const client of browserClients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg)
    }
  }

  function sendSubscribe() {
    if (alpacaWs?.readyState === WebSocket.OPEN && subscribedTickers.size > 0) {
      alpacaWs.send(JSON.stringify({ action: 'subscribe', trades: Array.from(subscribedTickers) }))
    }
  }

  function connect() {
    alpacaWs = new WebSocket(config.wsUrl)
    alpacaWs.on('open', () => {
      alpacaWs!.send(JSON.stringify({ action: 'auth', key: config.apiKey, secret: config.apiSecret }))
    })
    alpacaWs.on('message', (data: Buffer) => {
      const msgs = JSON.parse(data.toString()) as Array<{ T: string; S: string; p: number; t: string }>
      for (const msg of msgs) {
        if (msg.T === 'authenticated') sendSubscribe()
        if (msg.T === 't') broadcast({ ticker: msg.S, price: msg.p, timestamp: msg.t })
      }
    })
    alpacaWs.on('close', () => setTimeout(connect, 5000))
    alpacaWs.on('error', () => {})
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
  }
}
