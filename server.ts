import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocketServer } from 'ws'
import { buildWsManager } from './src/lib/alpaca/ws-server'
import { env } from './src/lib/env'

const port = parseInt(env.PORT, 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

export const wsManager = buildWsManager({
  apiKey: env.ALPACA_API_KEY,
  apiSecret: env.ALPACA_API_SECRET,
  wsUrl: env.ALPACA_WS_URL,
})

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url!, true))
  })

  const wss = new WebSocketServer({ server, path: '/ws' })
  wss.on('connection', (ws) => wsManager.registerBrowserClient(ws))

  wsManager.connect()

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
