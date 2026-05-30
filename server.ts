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

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`> Port ${port} is already in use`)
    } else {
      console.error('> Server error:', err.message)
    }
    process.exit(1)
  })

  const shutdown = () => {
    wsManager.disconnect()
    server.close(() => process.exit(0))
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
})
