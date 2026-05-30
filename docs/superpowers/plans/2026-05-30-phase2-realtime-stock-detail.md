# Stock Trading App — Phase 2: 실시간 시세 + 종목 상세

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alpaca 시세 데이터 API와 FMP API를 사용해 실시간 가격, 캔들스틱 차트, 호가창, 배당금을 표시하는 종목 상세 페이지 완성

**Architecture:** Alpaca 거래 API(`api.alpaca.markets`)와 별도인 데이터 API(`data.alpaca.markets`)로 차트·호가 데이터를 가져온다. 브라우저는 `/ws` WebSocket에 ticker를 구독 메시지로 전송하고 실시간 가격을 수신한다. 차트는 TradingView Lightweight Charts v4로 렌더링.

**Tech Stack:** lightweight-charts v4, Alpaca Data API, FMP API (배당), existing Next.js API Routes + WebSocket infra

---

## 파일 구조

```
src/
├── app/
│   ├── api/
│   │   └── stocks/
│   │       └── [ticker]/
│   │           ├── bars/route.ts          # 과거 OHLCV 바 데이터
│   │           ├── quote/route.ts         # 최신 호가 (bid/ask)
│   │           └── dividends/route.ts     # 배당금 이력 (FMP, 24h 캐시)
│   └── stock/
│       └── [ticker]/
│           └── page.tsx                   # 종목 상세 (scaffold 교체)
├── components/
│   └── stock/
│       ├── PriceDisplay.tsx               # 실시간 가격 + 등락률
│       ├── StockChart.tsx                 # TradingView 캔들스틱 차트
│       ├── OrderBook.tsx                  # 호가창 (bid/ask, 5초 폴링)
│       ├── DividendInfo.tsx               # 배당금 현황
│       └── TradePanel.tsx                 # 매수/매도 버튼 (Phase 4 placeholder)
├── hooks/
│   └── useRealtimePrice.ts               # 브라우저 WebSocket 훅
└── lib/
    └── alpaca/
        └── client.ts                      # 확장: data API 메서드 추가
server.ts                                  # 수정: 브라우저 구독 메시지 처리
__tests__/
├── app/api/stocks/
│   ├── bars.test.ts
│   ├── quote.test.ts
│   └── dividends.test.ts
└── lib/alpaca/
    └── client.test.ts                     # 기존 파일에 data API 테스트 추가
```

---

## Task 1: Alpaca 클라이언트 + 환경 변수 확장

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `src/lib/alpaca/client.ts`
- Modify: `jest.setup.ts`
- Modify: `.env.example`
- Modify: `__tests__/lib/alpaca/client.test.ts`

Alpaca는 두 개의 다른 기본 URL을 사용한다.
- 거래 API: `https://api.alpaca.markets` (기존 `ALPACA_BASE_URL`)
- 데이터 API: `https://data.alpaca.markets` (신규 `ALPACA_DATA_URL`)

- [ ] **Step 1: jest.setup.ts에 ALPACA_DATA_URL 추가**

파일 하단에 추가:
```typescript
process.env.ALPACA_DATA_URL = 'https://data.alpaca.markets'
```

- [ ] **Step 2: src/lib/env.ts 스키마에 ALPACA_DATA_URL 추가**

`schema` 객체 내 기존 항목 뒤에 추가:
```typescript
ALPACA_DATA_URL: z.string().url().default('https://data.alpaca.markets'),
```

- [ ] **Step 3: .env.example에 추가**

`ALPACA_BASE_URL=` 줄 아래에 추가:
```env
ALPACA_DATA_URL=https://data.alpaca.markets
```

- [ ] **Step 4: client.ts에 새 인터페이스 추가**

`AlpacaOrder` 인터페이스 아래에 추가:
```typescript
export interface AlpacaBar {
  t: string   // timestamp ISO8601
  o: number   // open
  h: number   // high
  l: number   // low
  c: number   // close
  v: number   // volume
}

export interface AlpacaQuote {
  t: string   // timestamp
  ap: number  // ask price
  as: number  // ask size
  bp: number  // bid price
  bs: number  // bid size
}

export interface AlpacaTrade {
  t: string   // timestamp
  p: number   // price
  s: number   // size
}
```

- [ ] **Step 5: ClientConfig에 ALPACA_DATA_URL 추가**

`interface ClientConfig` 수정:
```typescript
interface ClientConfig {
  ALPACA_API_KEY: string
  ALPACA_API_SECRET: string
  ALPACA_BASE_URL: string
  ALPACA_DATA_URL: string
}
```

- [ ] **Step 6: buildAlpacaClient에 dataReq 함수 + 메서드 추가**

`req` 함수 바로 아래에 추가:
```typescript
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
```

반환 객체에 메서드 추가:
```typescript
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
```

- [ ] **Step 7: 기존 테스트 파일에 data API 테스트 블록 추가**

`__tests__/lib/alpaca/client.test.ts` 하단에 추가:
```typescript
describe('data API methods', () => {
  test('getBars calls data URL with correct params', async () => {
    mockFetch({ bars: [{ t: '2024-01-15T09:30:00Z', o: 150, h: 155, l: 148, c: 152, v: 1000000 }] })
    const client = buildAlpacaClient({ ...cfg, ALPACA_DATA_URL: 'https://data.alpaca.markets' })
    const result = await client.getBars('AAPL', { timeframe: '1Day' })
    expect(result.bars[0].c).toBe(152)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('data.alpaca.markets/v2/stocks/AAPL/bars'),
      expect.any(Object)
    )
  })

  test('getLatestQuote returns quote data', async () => {
    mockFetch({ quote: { t: '2024-01-15T09:30:00Z', ap: 150.5, as: 100, bp: 150.0, bs: 200 } })
    const client = buildAlpacaClient({ ...cfg, ALPACA_DATA_URL: 'https://data.alpaca.markets' })
    const result = await client.getLatestQuote('AAPL')
    expect(result.quote.ap).toBe(150.5)
  })
})
```

- [ ] **Step 8: 테스트 실행**

```bash
npx jest client.test
```

Expected: PASS — 5 tests (기존 3 + 신규 2)

- [ ] **Step 9: 커밋**

```bash
git add src/lib/env.ts src/lib/alpaca/client.ts jest.setup.ts .env.example __tests__/lib/alpaca/client.test.ts
git commit -m "Feat: extend Alpaca client with data API methods (getBars, getLatestQuote, getLatestTrade)"
```

---

## Task 2: server.ts — 브라우저 구독 메시지 처리

**Files:**
- Modify: `server.ts`

브라우저 클라이언트가 WebSocket 연결 후 `{ action: 'subscribe', ticker: 'AAPL' }` 메시지를 보내면 서버가 Alpaca 스트림에 ticker를 구독해야 한다.

- [ ] **Step 1: server.ts의 wss.on('connection') 블록 수정**

기존:
```typescript
wss.on('connection', (ws) => wsManager.registerBrowserClient(ws))
```

교체:
```typescript
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
```

- [ ] **Step 2: 테스트 확인**

```bash
npx jest
```

Expected: 12 tests pass (기존 10 + Task 1 신규 2)

- [ ] **Step 3: 커밋**

```bash
git add server.ts
git commit -m "Feat: handle browser ticker subscription messages in WebSocket server"
```

---

## Task 3: Stock Bars API Route

**Files:**
- Create: `src/app/api/stocks/[ticker]/bars/route.ts`
- Create: `__tests__/app/api/stocks/bars.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/stocks/bars.test.ts
import { GET } from '@/app/api/stocks/[ticker]/bars/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getBars: jest.fn().mockResolvedValue({
      bars: [
        { t: '2024-01-15T09:30:00Z', o: 150, h: 155, l: 148, c: 152, v: 1000000 },
        { t: '2024-01-16T09:30:00Z', o: 152, h: 158, l: 150, c: 156, v: 1200000 },
      ],
    }),
  },
}))

function makeRequest(ticker: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/stocks/${ticker}/bars`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

test('GET returns bars for ticker', async () => {
  const res = await GET(makeRequest('AAPL'), { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.bars).toHaveLength(2)
  expect(data.bars[0].c).toBe(152)
})

test('GET passes timeframe param to Alpaca client', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await GET(makeRequest('AAPL', { timeframe: '1Hour' }), { params: Promise.resolve({ ticker: 'AAPL' }) })
  expect(alpaca.getBars).toHaveBeenCalledWith('AAPL', expect.objectContaining({ timeframe: '1Hour' }))
})

test('GET returns 400 for invalid timeframe', async () => {
  const res = await GET(makeRequest('AAPL', { timeframe: 'invalid' }), { params: Promise.resolve({ ticker: 'AAPL' }) })
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest bars.test
```

Expected: FAIL — `Cannot find module '@/app/api/stocks/[ticker]/bars/route'`

- [ ] **Step 3: bars/route.ts 구현**

```typescript
// src/app/api/stocks/[ticker]/bars/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day' | '1Week' | '1Month'
const VALID_TIMEFRAMES: Timeframe[] = ['1Min', '5Min', '15Min', '1Hour', '1Day', '1Week', '1Month']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const { searchParams } = req.nextUrl
    const timeframe = (searchParams.get('timeframe') ?? '1Day') as Timeframe

    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })
    }

    const start = searchParams.get('start') ?? undefined
    const end = searchParams.get('end') ?? undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined

    const data = await alpaca.getBars(ticker.toUpperCase(), { timeframe, start, end, limit })
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch bars'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest bars.test
```

Expected: PASS — 3 tests

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/stocks/ __tests__/app/api/stocks/bars.test.ts
git commit -m "Feat: add stock bars API route"
```

---

## Task 4: Stock Quote API Route

**Files:**
- Create: `src/app/api/stocks/[ticker]/quote/route.ts`
- Create: `__tests__/app/api/stocks/quote.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/stocks/quote.test.ts
import { GET } from '@/app/api/stocks/[ticker]/quote/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getLatestQuote: jest.fn().mockResolvedValue({
      quote: { t: '2024-01-15T09:30:00Z', ap: 150.5, as: 100, bp: 150.0, bs: 200 },
    }),
  },
}))

test('GET returns quote for ticker', async () => {
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.quote.ap).toBe(150.5)
  expect(data.quote.bp).toBe(150.0)
})

test('GET uppercases ticker', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await GET({} as Request, { params: Promise.resolve({ ticker: 'aapl' }) })
  expect(alpaca.getLatestQuote).toHaveBeenCalledWith('AAPL')
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest quote.test
```

Expected: FAIL

- [ ] **Step 3: quote/route.ts 구현**

```typescript
// src/app/api/stocks/[ticker]/quote/route.ts
import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const data = await alpaca.getLatestQuote(ticker.toUpperCase())
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch quote'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest quote.test
```

Expected: PASS — 2 tests

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/stocks/[ticker]/quote/ __tests__/app/api/stocks/quote.test.ts
git commit -m "Feat: add stock quote API route"
```

---

## Task 5: Dividends API Route (FMP)

**Files:**
- Create: `src/app/api/stocks/[ticker]/dividends/route.ts`
- Create: `__tests__/app/api/stocks/dividends.test.ts`

FMP API를 사용해 배당금 이력을 조회한다. 24시간 인메모리 캐시로 불필요한 API 호출을 방지한다.

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/stocks/dividends.test.ts
import { GET } from '@/app/api/stocks/[ticker]/dividends/route'

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      historical: [
        { date: '2024-02-09', dividend: 0.24, recordDate: '2024-02-12', paymentDate: '2024-02-15', declarationDate: '2024-02-01' },
        { date: '2023-11-10', dividend: 0.24, recordDate: '2023-11-13', paymentDate: '2023-11-16', declarationDate: '2023-11-01' },
      ],
    }),
  } as Response)
})

test('GET returns formatted dividend history', async () => {
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.dividends).toHaveLength(2)
  expect(data.dividends[0].amount).toBe(0.24)
  expect(data.dividends[0].date).toBe('2024-02-09')
})

test('GET returns empty array when no historical dividends', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ historical: [] }),
  } as Response)
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'BRKB' }) })
  const data = await res.json()
  expect(data.dividends).toHaveLength(0)
})

test('GET returns 502 on FMP API error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 } as Response)
  const res = await GET({} as Request, { params: Promise.resolve({ ticker: 'AAPL' }) })
  expect(res.status).toBe(502)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest dividends.test
```

Expected: FAIL

- [ ] **Step 3: dividends/route.ts 구현**

```typescript
// src/app/api/stocks/[ticker]/dividends/route.ts
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface FmpDividend {
  date: string
  dividend: number
  recordDate: string
  paymentDate: string
  declarationDate: string
}

interface FormattedDividend {
  date: string
  amount: number
  recordDate: string
  paymentDate: string
}

interface CacheEntry {
  data: FormattedDividend[]
  expires: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 24 * 60 * 60 * 1000

function format(historical: FmpDividend[]): FormattedDividend[] {
  return historical.slice(0, 10).map((d) => ({
    date: d.date,
    amount: d.dividend,
    recordDate: d.recordDate,
    paymentDate: d.paymentDate,
  }))
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const symbol = ticker.toUpperCase()

    const cached = cache.get(symbol)
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ dividends: cached.data })
    }

    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${symbol}?apikey=${env.FMP_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`FMP API error: ${res.status}`)

    const json = await res.json() as { historical?: FmpDividend[] }
    const dividends = format(json.historical ?? [])

    cache.set(symbol, { data: dividends, expires: Date.now() + CACHE_TTL })
    return NextResponse.json({ dividends })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dividends'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest dividends.test
```

Expected: PASS — 3 tests

- [ ] **Step 5: 전체 테스트 확인**

```bash
npx jest
```

Expected: PASS — 20 tests

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/stocks/[ticker]/dividends/ __tests__/app/api/stocks/dividends.test.ts
git commit -m "Feat: add dividends API route with 24h in-memory cache"
```

---

## Task 6: TradingView 설치 + useRealtimePrice 훅

**Files:**
- Create: `src/hooks/useRealtimePrice.ts`

- [ ] **Step 1: lightweight-charts 설치**

```bash
npm install lightweight-charts
```

- [ ] **Step 2: useRealtimePrice.ts 작성**

```typescript
// src/hooks/useRealtimePrice.ts
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
```

- [ ] **Step 3: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (훅은 브라우저 API 의존이라 jest 테스트 없음)

- [ ] **Step 4: 커밋**

```bash
git add src/hooks/useRealtimePrice.ts package.json package-lock.json
git commit -m "Feat: add useRealtimePrice WebSocket hook and install lightweight-charts"
```

---

## Task 7: PriceDisplay + OrderBook 컴포넌트

**Files:**
- Create: `src/components/stock/PriceDisplay.tsx`
- Create: `src/components/stock/OrderBook.tsx`

- [ ] **Step 1: PriceDisplay.tsx 작성**

```typescript
// src/components/stock/PriceDisplay.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRealtimePrice } from '@/hooks/useRealtimePrice'

interface SnapshotPrice {
  price: number
}

export default function PriceDisplay({ ticker }: { ticker: string }) {
  const realtime = useRealtimePrice(ticker)
  const [snapshot, setSnapshot] = useState<SnapshotPrice | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/quote`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        if (data.quote) setSnapshot({ price: (data.quote.ap + data.quote.bp) / 2 })
      })
      .catch(() => {})
  }, [ticker])

  const price = realtime?.price ?? snapshot?.price

  if (!price) {
    return <div className="animate-pulse h-16 bg-gray-800 rounded-xl mx-4 mt-2" />
  }

  return (
    <div className="px-4 py-3">
      <p className="text-3xl font-bold text-white">
        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {realtime ? '실시간' : '최근 호가 기준'}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: OrderBook.tsx 작성**

```typescript
// src/components/stock/OrderBook.tsx
'use client'

import { useEffect, useState } from 'react'

interface Quote {
  ap: number
  as: number
  bp: number
  bs: number
}

export default function OrderBook({ ticker }: { ticker: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    const fetchQuote = () =>
      fetch(`/api/stocks/${ticker}/quote`)
        .then((r) => r.json())
        .then((data) => { if (data.quote) setQuote(data.quote) })
        .catch(() => {})

    fetchQuote()
    const interval = setInterval(fetchQuote, 5000)
    return () => clearInterval(interval)
  }, [ticker])

  if (!quote) return <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />

  const spread = (quote.ap - quote.bp).toFixed(3)

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs mb-3 uppercase tracking-wide">호가</h3>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-gray-400 mb-1">매수 Bid</p>
          <p className="text-green-400 font-semibold text-lg">${quote.bp.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{quote.bs.toLocaleString()} 주</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">스프레드</p>
          <p className="text-gray-300 text-sm">${spread}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">매도 Ask</p>
          <p className="text-red-400 font-semibold text-lg">${quote.ap.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{quote.as.toLocaleString()} 주</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/components/stock/PriceDisplay.tsx src/components/stock/OrderBook.tsx
git commit -m "Feat: add PriceDisplay and OrderBook components"
```

---

## Task 8: StockChart 컴포넌트

**Files:**
- Create: `src/components/stock/StockChart.tsx`

TradingView Lightweight Charts v4 API 사용. 캔들스틱 + 거래량 히스토그램 + SMA-5/SMA-20 라인. 기간 선택 버튼(1일/1주/1달/1년/전체).

- [ ] **Step 1: StockChart.tsx 작성**

```typescript
// src/components/stock/StockChart.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createChart, ColorType, UTCTimestamp } from 'lightweight-charts'

interface Bar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

type Period = '1D' | '1W' | '1M' | '1Y' | 'ALL'

const PERIOD_CONFIG: Record<Period, { timeframe: string; days?: number; label: string }> = {
  '1D': { timeframe: '1Min', days: 1,   label: '1일' },
  '1W': { timeframe: '15Min', days: 7,  label: '1주' },
  '1M': { timeframe: '1Hour', days: 30, label: '1달' },
  '1Y': { timeframe: '1Day', days: 365, label: '1년' },
  'ALL': { timeframe: '1Day',            label: '전체' },
}

function toTs(t: string): UTCTimestamp {
  return Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp
}

function calcSMA(bars: Bar[], period: number): { time: UTCTimestamp; value: number }[] {
  return bars
    .map((bar, i) => {
      if (i < period - 1) return null
      const avg = bars.slice(i - period + 1, i + 1).reduce((s, b) => s + b.c, 0) / period
      return { time: toTs(bar.t), value: avg }
    })
    .filter(Boolean) as { time: UTCTimestamp; value: number }[]
}

export default function StockChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [period, setPeriod] = useState<Period>('1M')
  const [loading, setLoading] = useState(true)

  const buildChart = useCallback(async () => {
    if (!containerRef.current) return
    setLoading(true)

    const { timeframe, days } = PERIOD_CONFIG[period]
    const params = new URLSearchParams({ timeframe, limit: '1000' })
    if (days) {
      const start = new Date()
      start.setDate(start.getDate() - days)
      params.set('start', start.toISOString().slice(0, 10))
    }

    const res = await fetch(`/api/stocks/${ticker}/bars?${params}`)
    const json = await res.json() as { bars?: Bar[] }
    const bars = json.bars ?? []

    containerRef.current.innerHTML = ''

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: containerRef.current.clientWidth,
      height: 300,
      timeScale: { timeVisible: period === '1D', secondsVisible: false },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })

    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })

    const sma5  = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1 })
    const sma20 = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1 })

    candleSeries.setData(bars.map((b) => ({
      time: toTs(b.t), open: b.o, high: b.h, low: b.l, close: b.c,
    })))

    volSeries.setData(bars.map((b) => ({
      time: toTs(b.t), value: b.v, color: b.c >= b.o ? '#22c55e40' : '#ef444440',
    })))

    if (bars.length > 5)  sma5.setData(calcSMA(bars, 5))
    if (bars.length > 20) sma20.setData(calcSMA(bars, 20))

    chart.timeScale().fitContent()
    setLoading(false)
  }, [ticker, period])

  useEffect(() => { buildChart() }, [buildChart])

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 p-3 border-b border-gray-800">
        {(Object.keys(PERIOD_CONFIG) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {PERIOD_CONFIG[p].label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="w-3 h-0.5 bg-amber-400 inline-block" />
          <span className="text-[10px] text-gray-400">MA5</span>
          <span className="w-3 h-0.5 bg-violet-400 inline-block" />
          <span className="text-[10px] text-gray-400">MA20</span>
        </div>
      </div>
      {loading && <div className="animate-pulse h-[300px] bg-gray-800" />}
      <div ref={containerRef} className={loading ? 'sr-only' : ''} />
    </div>
  )
}
```

- [ ] **Step 2: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (차트는 canvas가 필요해 jest 불가)

- [ ] **Step 3: 커밋**

```bash
git add src/components/stock/StockChart.tsx
git commit -m "Feat: add StockChart with TradingView Lightweight Charts, SMA overlay, period selector"
```

---

## Task 9: DividendInfo + TradePanel 컴포넌트

**Files:**
- Create: `src/components/stock/DividendInfo.tsx`
- Create: `src/components/stock/TradePanel.tsx`

- [ ] **Step 1: DividendInfo.tsx 작성**

```typescript
// src/components/stock/DividendInfo.tsx
'use client'

import { useEffect, useState } from 'react'

interface Dividend {
  date: string
  amount: number
  paymentDate: string
  recordDate: string
}

export default function DividendInfo({ ticker }: { ticker: string }) {
  const [dividends, setDividends] = useState<Dividend[] | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/dividends`)
      .then((r) => r.json())
      .then((data) => setDividends(data.dividends ?? []))
      .catch(() => setDividends([]))
  }, [ticker])

  if (dividends === null) return <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />
  if (dividends.length === 0) return null

  const latest = dividends[0]
  const upcoming = dividends.find((d) => new Date(d.paymentDate) > new Date())

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs mb-3 uppercase tracking-wide">배당금</h3>
      <div className="flex gap-8">
        <div>
          <p className="text-xs text-gray-400 mb-1">최근 배당</p>
          <p className="text-white font-semibold">${latest.amount.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{latest.date}</p>
        </div>
        {upcoming && (
          <div>
            <p className="text-xs text-gray-400 mb-1">다음 지급일</p>
            <p className="text-blue-400 font-semibold">{upcoming.paymentDate}</p>
            <p className="text-xs text-gray-500">${upcoming.amount.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TradePanel.tsx 작성 (Phase 4 placeholder)**

```typescript
// src/components/stock/TradePanel.tsx
export default function TradePanel({ ticker: _ }: { ticker: string }) {
  return (
    <div className="flex gap-3 pb-2">
      <button
        disabled
        className="flex-1 py-3 rounded-xl bg-green-600 opacity-40 text-white font-semibold cursor-not-allowed text-sm"
      >
        매수
      </button>
      <button
        disabled
        className="flex-1 py-3 rounded-xl bg-red-600 opacity-40 text-white font-semibold cursor-not-allowed text-sm"
      >
        매도
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/components/stock/DividendInfo.tsx src/components/stock/TradePanel.tsx
git commit -m "Feat: add DividendInfo and TradePanel placeholder components"
```

---

## Task 10: 종목 상세 페이지 조립

**Files:**
- Modify: `src/app/stock/[ticker]/page.tsx`

- [ ] **Step 1: 종목 상세 페이지 구현**

`src/app/stock/[ticker]/page.tsx` 전체 교체:

```typescript
// src/app/stock/[ticker]/page.tsx
import TopBar from '@/components/layout/TopBar'
import PriceDisplay from '@/components/stock/PriceDisplay'
import StockChart from '@/components/stock/StockChart'
import OrderBook from '@/components/stock/OrderBook'
import DividendInfo from '@/components/stock/DividendInfo'
import TradePanel from '@/components/stock/TradePanel'

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  const symbol = ticker.toUpperCase()

  return (
    <>
      <TopBar title={symbol} />
      <div className="space-y-4 pb-4">
        <PriceDisplay ticker={symbol} />
        <div className="px-4 space-y-4">
          <StockChart ticker={symbol} />
          <OrderBook ticker={symbol} />
          <DividendInfo ticker={symbol} />
          <TradePanel ticker={symbol} />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: 전체 테스트 최종 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/stock/[ticker]/page.tsx
git commit -m "Feat: assemble stock detail page (realtime price, chart, order book, dividends)"
```

---

## Phase 2 완료 기준

- [ ] `npx jest` → 모든 테스트 PASS
- [ ] Alpaca API 키 설정 후 `/api/stocks/AAPL/bars` 응답 정상
- [ ] `/stock/AAPL` 페이지 → 캔들스틱 차트, 호가창, 배당금 표시
- [ ] 실시간 가격 WebSocket 연결 → 브라우저 콘솔에서 확인

## 다음 단계

Phase 3 (Lot 추적 + 포트폴리오) 계획을 작성하려면 요청하세요.
