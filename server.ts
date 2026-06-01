import 'dotenv/config'
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocketServer } from 'ws'
import { buildWsManager } from './src/lib/alpaca/ws-server'
import { env } from './src/lib/env'
import { runRecurringInvestments } from './src/lib/recurring-runner'
import { verifySession } from './src/lib/session'
import { checkStrategies } from './src/lib/strategy-monitor'
import { checkAlerts } from './src/lib/alert-monitor'

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

  const wss = new WebSocketServer({ noServer: true })
  wss.on('connection', (ws) => {
    wsManager.registerBrowserClient(ws)
    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { action: string; ticker?: string }
        if (msg.action === 'subscribe' && msg.ticker) {
          wsManager.subscribeTicker(msg.ticker)
        }
      } catch {}
    })
  })

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws') {
      // Verify session cookie before upgrading
      const cookieHeader = req.headers.cookie ?? ''
      const sessionMatch = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/)
      const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : undefined
      if (!verifySession(sessionToken)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    }
    // Other paths (/_next/webpack-hmr etc.) handled by Next.js internally
  })

  wsManager.connect()

  // Recurring investment scheduler — guarded against overlapping runs
  let recurringRunning = false
  setInterval(async () => {
    if (recurringRunning) return
    recurringRunning = true
    try {
      await runRecurringInvestments(new Date())
    } catch (e) {
      console.error('[Recurring] Error:', e)
    } finally {
      recurringRunning = false
    }
  }, 60 * 1000)

  // Strategy monitor — guarded against overlapping runs
  let strategyRunning = false
  setInterval(async () => {
    if (strategyRunning) return
    strategyRunning = true
    try {
      await checkStrategies()
    } catch (e) {
      console.error('[Strategy Monitor] Error:', e)
    } finally { strategyRunning = false }
  }, 30 * 1000)

  // Alert monitor — guarded against overlapping runs
  let alertRunning = false
  setInterval(async () => {
    if (alertRunning) return
    alertRunning = true
    try { await checkAlerts() } catch (e) { console.error('[Alert Monitor]', e) }
    finally { alertRunning = false }
  }, 60 * 1000)

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
    console.log(`> TRADING MODE: ${env.ALPACA_TRADING_MODE.toUpperCase()}`)
    if (env.ALPACA_TRADING_MODE === 'live') {
      console.warn('⚠️  LIVE TRADING ENABLED — real money at risk')
    }
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
