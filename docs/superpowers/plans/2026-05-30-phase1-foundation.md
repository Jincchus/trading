# Stock Trading App — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 프로젝트 셋업, SQLite 스키마, Alpaca REST/WebSocket 클라이언트, 커스텀 서버, 8페이지 내비게이션 쉘 완성

**Architecture:** Next.js App Router + 커스텀 Node.js HTTP 서버(ws). Alpaca WebSocket → 서버 WS 매니저 → 브라우저 실시간 중계. SQLite(Prisma)로 앱 데이터 관리. `.env`로 모든 API 키 관리.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Prisma + SQLite, ws, Zod, tsx, lucide-react, Jest + ts-jest

---

## 전체 Phase 구성

| Phase | 내용 | 문서 |
|-------|------|------|
| **1. Foundation** | 셋업, DB 스키마, Alpaca 클라이언트, WebSocket, 네비게이션 | 이 문서 |
| 2. 실시간 시세 + 종목 상세 | 차트, 호가창, 배당 | 별도 |
| 3. Lot 추적 + 포트폴리오 | Lot DB, 매수 시 Lot 생성, P&L, 카테고리 | 별도 |
| 4. 주문 + 정기 투자 | 주문 폼, Lot 선택 매도, Cron 정기 투자 | 별도 |
| 5. 자동 전략 | 전략 빌더, 백그라운드 가격 모니터링, 자동 매도 | 별도 |
| 6. 환전 추적 + 세금 | Wise CSV 파싱, 환차익 계산, Excel 출력 | 별도 |
| 7. 알림 (Web Push) | 목표가, 체결, 전략 알림 | 별도 |
| 8. 종목 탐색 + 대시보드 | 검색, 테마, 랭킹, 관심종목, 홈 화면 | 별도 |

---

## 파일 구조

```
stock-trading-app/
├── .env.example
├── .gitignore
├── jest.config.ts
├── jest.setup.ts                          # 테스트용 env 기본값
├── next.config.ts
├── server.ts                              # 커스텀 HTTP + WebSocket 서버
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # 홈
│   │   ├── portfolio/page.tsx
│   │   ├── explore/page.tsx
│   │   ├── stock/[ticker]/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── assets/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/account/route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx
│   │   │   └── TopBar.tsx
│   │   └── account/
│   │       └── AccountSummary.tsx
│   └── lib/
│       ├── db.ts
│       ├── env.ts
│       └── alpaca/
│           ├── client.ts
│           └── ws-server.ts
└── __tests__/
    ├── lib/
    │   ├── env.test.ts
    │   └── alpaca/
    │       ├── client.test.ts
    │       └── ws-server.test.ts
    └── app/api/
        └── account.test.ts
```

---

## Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `.gitignore` 추가

- [ ] **Step 1: Next.js 앱 생성**

`C:\Users\박경진\stock-trading-app` 디렉토리 안에서 실행:

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
```

프롬프트가 나오면 모두 기본값(Enter).

- [ ] **Step 2: 추가 패키지 설치**

```bash
npm install ws zod @prisma/client lucide-react papaparse xlsx
npm install --save-dev prisma @types/ws jest ts-jest @types/jest jest-environment-node tsx
```

- [ ] **Step 3: jest.setup.ts 작성 — 테스트용 env 기본값**

```typescript
// jest.setup.ts
process.env.ALPACA_API_KEY = 'test-key'
process.env.ALPACA_API_SECRET = 'test-secret'
process.env.ALPACA_BASE_URL = 'https://paper-api.alpaca.markets'
process.env.ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v2/iex'
process.env.FMP_API_KEY = 'test-fmp-key'
process.env.EXCHANGE_RATE_API_KEY = 'test-er-key'
```

- [ ] **Step 4: jest.config.ts 작성**

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default config
```

- [ ] **Step 5: package.json scripts 업데이트**

`scripts` 섹션을 아래로 교체:

```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts",
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

- [ ] **Step 6: .gitignore에 추가**

파일 하단에 아래 라인 추가:

```
prisma/*.db
prisma/*.db-journal
```

- [ ] **Step 7: 동작 확인**

```bash
npx jest --passWithNoTests
```

Expected: `Test Suites: 0 skipped, 0 total`

- [ ] **Step 8: 커밋**

```bash
git init
git add .
git commit -m "Feat: initialize Next.js project with dependencies"
```

---

## Task 2: 환경 변수 검증

**Files:**
- Create: `src/lib/env.ts`
- Create: `.env.example`
- Create: `__tests__/lib/env.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/env.test.ts
import { parseEnv } from '@/lib/env'

const valid = {
  ALPACA_API_KEY: 'key',
  ALPACA_API_SECRET: 'secret',
  FMP_API_KEY: 'fmp',
  EXCHANGE_RATE_API_KEY: 'er',
}

test('valid env passes with defaults', () => {
  const result = parseEnv(valid as NodeJS.ProcessEnv)
  expect(result.ALPACA_API_KEY).toBe('key')
  expect(result.ALPACA_BASE_URL).toBe('https://api.alpaca.markets')
  expect(result.PORT).toBe('3000')
})

test('missing required key throws', () => {
  expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow('Invalid environment variables')
})

test('custom PORT is respected', () => {
  const result = parseEnv({ ...valid, PORT: '8080' } as NodeJS.ProcessEnv)
  expect(result.PORT).toBe('8080')
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest env.test
```

Expected: FAIL — `Cannot find module '@/lib/env'`

- [ ] **Step 3: env.ts 구현**

```typescript
// src/lib/env.ts
import { z } from 'zod'

const schema = z.object({
  ALPACA_API_KEY: z.string().min(1),
  ALPACA_API_SECRET: z.string().min(1),
  ALPACA_BASE_URL: z.string().url().default('https://api.alpaca.markets'),
  ALPACA_WS_URL: z.string().url().default('wss://stream.data.alpaca.markets/v2/iex'),
  FMP_API_KEY: z.string().min(1),
  EXCHANGE_RATE_API_KEY: z.string().min(1),
  PORT: z.string().default('3000'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors)}`)
  }
  return result.data
}

export const env = parseEnv(process.env)
```

- [ ] **Step 4: .env.example 작성**

```env
# Alpaca Markets (https://alpaca.markets)
ALPACA_API_KEY=
ALPACA_API_SECRET=
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_WS_URL=wss://stream.data.alpaca.markets/v2/iex

# Financial Modeling Prep (https://financialmodelingprep.com)
FMP_API_KEY=

# ExchangeRate-API (https://www.exchangerate-api.com)
EXCHANGE_RATE_API_KEY=

# Server
PORT=3000
```

`.env.example`을 복사해 `.env` 생성 후 실제 키 입력.

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest env.test
```

Expected: PASS — 3 tests

- [ ] **Step 6: 커밋**

```bash
git add src/lib/env.ts .env.example __tests__/lib/env.test.ts jest.config.ts jest.setup.ts
git commit -m "Feat: add Zod environment validation"
```

---

## Task 3: Prisma 스키마 + SQLite

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Prisma 초기화**

```bash
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 2: schema.prisma 전체 작성**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Lot {
  id            String        @id @default(cuid())
  ticker        String
  quantity      Float
  purchasePrice Float
  purchaseDate  DateTime
  alpacaOrderId String        @unique
  soldQuantity  Float         @default(0)
  status        String        @default("active")
  strategyId    String?
  strategy      Strategy?     @relation(fields: [strategyId], references: [id])
  taxRecords    TaxRecord[]
  createdAt     DateTime      @default(now())
}

model Category {
  id     String          @id @default(cuid())
  name   String          @unique
  color  String          @default("#3b82f6")
  stocks StockCategory[]
}

model StockCategory {
  ticker     String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([ticker, categoryId])
}

model Strategy {
  id    String         @id @default(cuid())
  name  String
  rules StrategyRule[]
  lots  Lot[]
}

model StrategyRule {
  id         String   @id @default(cuid())
  threshold  Float
  sellPct    Float
  strategyId String
  strategy   Strategy @relation(fields: [strategyId], references: [id], onDelete: Cascade)
}

model FxRecord {
  id           String   @id @default(cuid())
  date         DateTime
  krwAmount    Float
  exchangeRate Float
  usdAmount    Float
  source       String
  createdAt    DateTime @default(now())
}

model TaxRecord {
  id           String   @id @default(cuid())
  lotId        String
  lot          Lot      @relation(fields: [lotId], references: [id])
  ticker       String
  acquireDate  DateTime
  acquirePrice Float
  acquireRate  Float
  saleDate     DateTime
  salePrice    Float
  saleRate     Float
  quantity     Float
  gainKrw      Float
  createdAt    DateTime @default(now())
}

model Alert {
  id          String         @id @default(cuid())
  ticker      String
  targetPrice Float
  direction   String
  active      Boolean        @default(true)
  history     AlertHistory[]
  createdAt   DateTime       @default(now())
}

model AlertHistory {
  id          String   @id @default(cuid())
  alertId     String
  alert       Alert    @relation(fields: [alertId], references: [id])
  triggeredAt DateTime @default(now())
  price       Float
}
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
npx prisma migrate dev --name init
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: db.ts 작성**

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: 커밋**

```bash
git add prisma/ src/lib/db.ts
git commit -m "Feat: add Prisma schema with SQLite (Lot, Category, Strategy, FxRecord, TaxRecord, Alert)"
```

---

## Task 4: Alpaca REST 클라이언트

**Files:**
- Create: `src/lib/alpaca/client.ts`
- Create: `__tests__/lib/alpaca/client.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/alpaca/client.test.ts
import { buildAlpacaClient } from '@/lib/alpaca/client'

const cfg = {
  ALPACA_API_KEY: 'test-key',
  ALPACA_API_SECRET: 'test-secret',
  ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
}

function mockFetch(data: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response)
}

test('getAccount returns account data with correct headers', async () => {
  mockFetch({ equity: '15000.00', buying_power: '10000.00', cash: '5000.00', portfolio_value: '15000.00' })
  const client = buildAlpacaClient(cfg)
  const result = await client.getAccount()
  expect(result.equity).toBe('15000.00')
  expect(global.fetch).toHaveBeenCalledWith(
    'https://paper-api.alpaca.markets/v2/account',
    expect.objectContaining({
      headers: expect.objectContaining({ 'APCA-API-KEY-ID': 'test-key' }),
    })
  )
})

test('getPositions returns position list', async () => {
  mockFetch([{ symbol: 'AAPL', qty: '10', avg_entry_price: '150.00', current_price: '175.00', unrealized_pl: '250.00', unrealized_plpc: '0.1667' }])
  const client = buildAlpacaClient(cfg)
  const result = await client.getPositions()
  expect(result[0].symbol).toBe('AAPL')
})

test('throws on API error', async () => {
  mockFetch({ message: 'Unauthorized' }, 401)
  const client = buildAlpacaClient(cfg)
  await expect(client.getAccount()).rejects.toThrow('Alpaca API error: 401')
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest client.test
```

Expected: FAIL — `Cannot find module '@/lib/alpaca/client'`

- [ ] **Step 3: client.ts 구현**

```typescript
// src/lib/alpaca/client.ts
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
    if (!res.ok) throw new Error(`Alpaca API error: ${res.status}`)
    return res.json()
  }

  return {
    getAccount: (): Promise<AlpacaAccount> => req('/v2/account'),
    getPositions: (): Promise<AlpacaPosition[]> => req('/v2/positions'),
    getOrders: (params?: { status?: string; limit?: number }): Promise<AlpacaOrder[]> => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest client.test
```

Expected: PASS — 3 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/alpaca/client.ts __tests__/lib/alpaca/client.test.ts
git commit -m "Feat: add Alpaca REST client"
```

---

## Task 5: WebSocket 서버 매니저

**Files:**
- Create: `src/lib/alpaca/ws-server.ts`
- Create: `__tests__/lib/alpaca/ws-server.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/alpaca/ws-server.test.ts
import { buildWsManager, PriceUpdate } from '@/lib/alpaca/ws-server'

const cfg = { apiKey: 'k', apiSecret: 's', wsUrl: 'wss://x' }

test('subscribeTicker adds ticker', () => {
  const mgr = buildWsManager(cfg)
  mgr.subscribeTicker('AAPL')
  expect(mgr.getSubscribedTickers()).toContain('AAPL')
})

test('subscribeTicker ignores duplicate', () => {
  const mgr = buildWsManager(cfg)
  mgr.subscribeTicker('AAPL')
  mgr.subscribeTicker('AAPL')
  expect(mgr.getSubscribedTickers().filter((t: string) => t === 'AAPL')).toHaveLength(1)
})

test('broadcast sends to open clients only', () => {
  const mgr = buildWsManager(cfg)
  const sent: string[] = []
  const openClient = { readyState: 1, send: (m: string) => sent.push(m), on: () => {} }
  const closedClient = { readyState: 3, send: jest.fn(), on: () => {} }
  mgr.registerBrowserClient(openClient as any)
  mgr.registerBrowserClient(closedClient as any)
  mgr.broadcastForTest({ ticker: 'AAPL', price: 150, timestamp: 'ts' })
  expect(sent).toHaveLength(1)
  expect(JSON.parse(sent[0])).toMatchObject({ ticker: 'AAPL', price: 150 })
  expect(closedClient.send).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest ws-server.test
```

Expected: FAIL — `Cannot find module '@/lib/alpaca/ws-server'`

- [ ] **Step 3: ws-server.ts 구현**

```typescript
// src/lib/alpaca/ws-server.ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest ws-server.test
```

Expected: PASS — 3 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/alpaca/ws-server.ts __tests__/lib/alpaca/ws-server.test.ts
git commit -m "Feat: add Alpaca WebSocket server manager"
```

---

## Task 6: Custom Next.js 서버

**Files:**
- Create: `server.ts`

- [ ] **Step 1: server.ts 작성**

```typescript
// server.ts
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
```

- [ ] **Step 2: 서버 실행 확인**

`.env` 파일에 실제 Alpaca 키가 있어야 한다.

```bash
npm run dev
```

Expected: `> Ready on http://localhost:3000`  
브라우저에서 `http://localhost:3000` → Next.js 페이지 로드 확인.

- [ ] **Step 3: 커밋**

```bash
git add server.ts
git commit -m "Feat: add custom Next.js server with WebSocket support"
```

---

## Task 7: 레이아웃 + Bottom Navigation

**Files:**
- Create: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: BottomNav.tsx 작성**

```typescript
// src/components/layout/BottomNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Search, ShoppingCart, Wallet, Bell, Settings } from 'lucide-react'

const NAV = [
  { href: '/', label: '홈', icon: Home },
  { href: '/portfolio', label: '포트폴리오', icon: BarChart2 },
  { href: '/explore', label: '탐색', icon: Search },
  { href: '/orders', label: '주문', icon: ShoppingCart },
  { href: '/assets', label: '자산', icon: Wallet },
  { href: '/alerts', label: '알림', icon: Bell },
  { href: '/settings', label: '설정', icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg ${
                active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: TopBar.tsx 작성**

```typescript
// src/components/layout/TopBar.tsx
export default function TopBar({ title }: { title: string }) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
      <div className="flex items-center h-12 max-w-md mx-auto px-4">
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: layout.tsx 업데이트**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/layout/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '주식 트레이딩',
  description: 'Personal stock trading app',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-950 text-white`}>
        <main className="max-w-md mx-auto min-h-screen pb-16 pt-12">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: globals.css 업데이트**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  -webkit-tap-highlight-color: transparent;
}

body {
  overscroll-behavior: none;
}
```

- [ ] **Step 5: 브라우저 확인**

```bash
npm run dev
```

`http://localhost:3000` → 하단 7개 탭 표시, 탭 클릭 시 URL 변경 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/components/layout/ src/app/layout.tsx src/app/globals.css
git commit -m "Feat: add bottom navigation and app shell layout"
```

---

## Task 8: 페이지 스캐폴딩

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/portfolio/page.tsx`
- Create: `src/app/explore/page.tsx`
- Create: `src/app/stock/[ticker]/page.tsx`
- Create: `src/app/orders/page.tsx`
- Create: `src/app/assets/page.tsx`
- Create: `src/app/alerts/page.tsx`
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: 8개 페이지 scaffold 작성**

```typescript
// src/app/page.tsx
import TopBar from '@/components/layout/TopBar'
export default function HomePage() {
  return <><TopBar title="홈" /><div className="p-4"><p className="text-gray-400">홈 — Phase 8에서 완성</p></div></>
}

// src/app/portfolio/page.tsx
import TopBar from '@/components/layout/TopBar'
export default function PortfolioPage() {
  return <><TopBar title="포트폴리오" /><div className="p-4"><p className="text-gray-400">포트폴리오 — Phase 3에서 완성</p></div></>
}

// src/app/explore/page.tsx
import TopBar from '@/components/layout/TopBar'
export default function ExplorePage() {
  return <><TopBar title="종목 탐색" /><div className="p-4"><p className="text-gray-400">종목 탐색 — Phase 8에서 완성</p></div></>
}

// src/app/stock/[ticker]/page.tsx
import TopBar from '@/components/layout/TopBar'
export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  return <><TopBar title={ticker} /><div className="p-4"><p className="text-gray-400">종목 상세 — Phase 2에서 완성</p></div></>
}

// src/app/orders/page.tsx
import TopBar from '@/components/layout/TopBar'
export default function OrdersPage() {
  return <><TopBar title="주문" /><div className="p-4"><p className="text-gray-400">주문 — Phase 4에서 완성</p></div></>
}

// src/app/assets/page.tsx
import TopBar from '@/components/layout/TopBar'
export default function AssetsPage() {
  return <><TopBar title="자산 관리" /><div className="p-4"><p className="text-gray-400">자산 관리 — Phase 6에서 완성</p></div></>
}

// src/app/alerts/page.tsx
import TopBar from '@/components/layout/TopBar'
export default function AlertsPage() {
  return <><TopBar title="알림" /><div className="p-4"><p className="text-gray-400">알림 — Phase 7에서 완성</p></div></>
}

// src/app/settings/page.tsx
import TopBar from '@/components/layout/TopBar'
export default function SettingsPage() {
  return <><TopBar title="설정" /><div className="p-4"><p className="text-gray-400">설정 — Phase 3, 5에서 완성</p></div></>
}
```

- [ ] **Step 2: 모든 탭 라우팅 확인**

```bash
npm run dev
```

7개 탭 모두 클릭 → 각 TopBar 제목이 올바르게 표시.

- [ ] **Step 3: 커밋**

```bash
git add src/app/
git commit -m "Feat: add page scaffolds for all 8 routes"
```

---

## Task 9: Account API Route + 계좌 요약

**Files:**
- Create: `src/app/api/account/route.ts`
- Create: `src/components/account/AccountSummary.tsx`
- Modify: `src/app/page.tsx`
- Create: `__tests__/app/api/account.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/account.test.ts
import { GET } from '@/app/api/account/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getAccount: jest.fn().mockResolvedValue({
      buying_power: '10000.00',
      cash: '5000.00',
      portfolio_value: '15000.00',
      equity: '15000.00',
    }),
  },
}))

test('GET /api/account returns account data', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.equity).toBe('15000.00')
  expect(data.buying_power).toBe('10000.00')
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest account.test
```

Expected: FAIL — `Cannot find module '@/app/api/account/route'`

- [ ] **Step 3: API Route 구현**

```typescript
// src/app/api/account/route.ts
import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function GET() {
  const account = await alpaca.getAccount()
  return NextResponse.json(account)
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest account.test
```

Expected: PASS — 1 test

- [ ] **Step 5: AccountSummary.tsx 작성**

```typescript
// src/components/account/AccountSummary.tsx
'use client'

import { useEffect, useState } from 'react'
import type { AlpacaAccount } from '@/lib/alpaca/client'

export default function AccountSummary() {
  const [account, setAccount] = useState<AlpacaAccount | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/account')
      .then((r) => r.json())
      .then(setAccount)
      .catch(() => setError(true))
  }, [])

  if (error) return <p className="text-red-400 text-sm p-4">계좌 정보를 불러올 수 없습니다</p>
  if (!account) return <div className="bg-gray-900 rounded-xl p-4 animate-pulse h-24" />

  const fmt = (val: string) =>
    parseFloat(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">총 자산</p>
      <p className="text-2xl font-bold">{fmt(account.equity)}</p>
      <div className="flex gap-6 mt-3">
        <div>
          <p className="text-gray-400 text-xs">주문 가능</p>
          <p className="text-sm">{fmt(account.buying_power)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">현금</p>
          <p className="text-sm">{fmt(account.cash)}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 홈 페이지에 AccountSummary 추가**

```typescript
// src/app/page.tsx
import TopBar from '@/components/layout/TopBar'
import AccountSummary from '@/components/account/AccountSummary'

export default function HomePage() {
  return (
    <>
      <TopBar title="홈" />
      <div className="p-4 space-y-4">
        <AccountSummary />
      </div>
    </>
  )
}
```

- [ ] **Step 7: 전체 스택 E2E 확인**

```bash
npm run dev
```

`http://localhost:3000` → 실제 Alpaca 계좌 잔고가 표시되면 성공.

- [ ] **Step 8: 전체 테스트 통과 확인**

```bash
npx jest
```

Expected: PASS — 10 tests (env: 3, client: 3, ws-server: 3, account: 1)

- [ ] **Step 9: 최종 커밋**

```bash
git add src/app/api/ src/components/account/ __tests__/app/api/
git commit -m "Feat: add account API route and summary component"
```

---

## Phase 1 완료 기준

- [ ] `npx jest` → 10개 테스트 모두 PASS
- [ ] `npm run dev` → 브라우저에서 앱 실행, 계좌 잔고 표시
- [ ] 7개 탭 내비게이션 모두 동작
- [ ] `.env.example` 완비 (지인 공유 준비)

---

## 다음 단계

Phase 2 (실시간 시세 + 종목 상세) 계획을 시작하려면 이 대화에서 요청하세요.
