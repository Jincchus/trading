# Stock Trading App — Phase 8: 종목 탐색 + 대시보드

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 종목 검색·인기 종목·테마·관심종목을 포함한 탐색 페이지와, 총 자산·보유 종목·환차익 요약을 보여주는 홈 대시보드 완성

**Architecture:** FMP API로 종목 검색 및 인기 종목 조회(5분 캐시). 관심종목은 신규 Prisma Watchlist 모델로 관리. 테마는 하드코딩된 정적 데이터(API 불필요). 홈 페이지는 기존 AccountSummary에 HoldingsMini + FxPnlMini 카드를 추가.

**Tech Stack:** FMP API (검색·인기 종목), Prisma Watchlist 모델, Next.js API Routes, Tailwind CSS

---

## 파일 구조

```
prisma/schema.prisma                   # Watchlist 모델 추가
src/
├── app/
│   ├── api/
│   │   ├── search/route.ts            # GET /api/search?q=
│   │   ├── market/
│   │   │   ├── actives/route.ts       # GET /api/market/actives (5분 캐시)
│   │   │   └── themes/route.ts        # GET /api/market/themes (정적)
│   │   └── watchlist/
│   │       ├── route.ts              # GET/POST /api/watchlist
│   │       └── [ticker]/route.ts     # DELETE /api/watchlist/[ticker]
│   ├── explore/
│   │   └── page.tsx                  # 종목 탐색 페이지 (scaffold 교체)
│   └── page.tsx                      # 홈 대시보드 (기존 + 컴포넌트 추가)
├── components/
│   ├── explore/
│   │   ├── SearchBar.tsx             # 종목 검색 (디바운스)
│   │   ├── ActivesList.tsx           # 인기 종목 랭킹
│   │   ├── ThemeGrid.tsx             # 테마별 종목 카드
│   │   └── WatchlistSection.tsx      # 관심종목 목록
│   └── dashboard/
│       ├── HoldingsMini.tsx          # 상위 3개 보유 종목
│       └── FxPnlMini.tsx             # 환차익/손실 요약
__tests__/app/api/
├── search.test.ts
├── market/actives.test.ts
└── watchlist/watchlist.test.ts
```

---

## Task 1: Watchlist 스키마 + CRUD API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/app/api/watchlist/route.ts`
- Create: `src/app/api/watchlist/[ticker]/route.ts`
- Create: `__tests__/app/api/watchlist/watchlist.test.ts`

- [ ] **Step 1: schema.prisma에 Watchlist 모델 추가**

`prisma/schema.prisma`의 마지막 모델 아래에 추가:

```prisma
model Watchlist {
  ticker  String   @id
  addedAt DateTime @default(now())
}
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
npx prisma migrate dev --name add-watchlist
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: 테스트 작성**

```typescript
// __tests__/app/api/watchlist/watchlist.test.ts
import { GET, POST } from '@/app/api/watchlist/route'
import { DELETE } from '@/app/api/watchlist/[ticker]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    watchlist: {
      findMany: jest.fn().mockResolvedValue([
        { ticker: 'AAPL', addedAt: new Date() },
        { ticker: 'MSFT', addedAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue({ ticker: 'NVDA', addedAt: new Date() }),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('GET returns watchlist tickers', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.tickers).toHaveLength(2)
  expect(data.tickers[0]).toBe('AAPL')
})

test('POST adds ticker to watchlist', async () => {
  const req = new NextRequest('http://localhost/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'NVDA' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  expect((await res.json()).ticker).toBe('NVDA')
})

test('POST returns 400 for missing ticker', async () => {
  const req = new NextRequest('http://localhost/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})

test('DELETE removes ticker from watchlist', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ ticker: 'AAPL' }),
  })
  expect((await res.json()).ok).toBe(true)
})
```

- [ ] **Step 4: 테스트 실행 (실패 확인)**

```bash
npx jest watchlist.test
```

Expected: FAIL

- [ ] **Step 5: watchlist/route.ts 구현**

```typescript
// src/app/api/watchlist/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const items = await prisma.watchlist.findMany({ orderBy: { addedAt: 'desc' } })
  return NextResponse.json({ tickers: items.map((w) => w.ticker) })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticker?: string }
    if (!body.ticker?.trim()) {
      return NextResponse.json({ error: 'Ticker required' }, { status: 400 })
    }
    const item = await prisma.watchlist.create({
      data: { ticker: body.ticker.trim().toUpperCase() },
    })
    return NextResponse.json({ ticker: item.ticker }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
```

- [ ] **Step 6: watchlist/[ticker]/route.ts 구현**

```typescript
// src/app/api/watchlist/[ticker]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    await prisma.watchlist.delete({ where: { ticker: ticker.toUpperCase() } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
npx jest watchlist.test
```

Expected: PASS — 4 tests

- [ ] **Step 8: 커밋**

```bash
git add prisma/ src/app/api/watchlist/ __tests__/app/api/watchlist/
git commit -m "Feat: add Watchlist model and CRUD API"
```

---

## Task 2: 검색 API + 인기 종목 API

**Files:**
- Create: `src/app/api/search/route.ts`
- Create: `src/app/api/market/actives/route.ts`
- Create: `src/app/api/market/themes/route.ts`
- Create: `__tests__/app/api/search.test.ts`
- Create: `__tests__/app/api/market/actives.test.ts`

- [ ] **Step 1: 검색 API 테스트 작성**

```typescript
// __tests__/app/api/search.test.ts
import { GET } from '@/app/api/search/route'
import { NextRequest } from 'next/server'

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      { symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD', stockExchange: 'NASDAQ', exchangeShortName: 'NASDAQ' },
      { symbol: 'AAPLX', name: 'Apple Fund', currency: 'USD', stockExchange: 'MUTUAL_FUND', exchangeShortName: 'MUTUAL_FUND' },
    ]),
  } as Response)
})

function makeReq(query: string) {
  return new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(query)}`)
}

test('GET returns stock search results filtered to stocks', async () => {
  const res = await GET(makeReq('AAPL'))
  const data = await res.json()
  // mutual funds filtered out
  expect(data.results.every((r: { type: string }) => r.type === 'stock')).toBe(true)
})

test('GET returns 400 when query is empty', async () => {
  const res = await GET(new NextRequest('http://localhost/api/search'))
  expect(res.status).toBe(400)
})

test('GET returns empty array on FMP error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 } as Response)
  const res = await GET(makeReq('AAPL'))
  const data = await res.json()
  expect(data.results).toHaveLength(0)
})
```

- [ ] **Step 2: 인기 종목 API 테스트 작성**

```typescript
// __tests__/app/api/market/actives.test.ts
import { GET } from '@/app/api/market/actives/route'

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      { symbol: 'NVDA', name: 'NVIDIA', changesPercentage: 3.5, price: 875.0, volume: 50000000 },
      { symbol: 'TSLA', name: 'Tesla', changesPercentage: -1.2, price: 250.0, volume: 40000000 },
    ]),
  } as Response)
})

test('GET returns most active stocks', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.actives).toHaveLength(2)
  expect(data.actives[0].symbol).toBe('NVDA')
})

test('GET returns empty array on FMP error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
  const res = await GET()
  const data = await res.json()
  expect(data.actives).toHaveLength(0)
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npx jest search.test actives.test
```

Expected: FAIL

- [ ] **Step 4: search/route.ts 구현**

```typescript
// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface FmpSearchResult {
  symbol: string
  name: string
  currency: string
  exchangeShortName: string
}

const STOCK_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX', 'NYSE ARCA', 'OTC'])

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    const url = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=15&apikey=${env.FMP_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ results: [] })

    const raw = await res.json() as FmpSearchResult[]
    const results = raw
      .filter((r) => STOCK_EXCHANGES.has(r.exchangeShortName))
      .slice(0, 10)
      .map((r) => ({
        symbol: r.symbol,
        name: r.name,
        exchange: r.exchangeShortName,
        type: 'stock',
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
```

- [ ] **Step 5: market/actives/route.ts 구현**

```typescript
// src/app/api/market/actives/route.ts
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

interface FmpActive {
  symbol: string
  name: string
  changesPercentage: number
  price: number
  volume: number
}

let cache: { data: FmpActive[]; expires: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json({ actives: cache.data })
  }

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/actives?apikey=${env.FMP_API_KEY}`
    )
    if (!res.ok) return NextResponse.json({ actives: [] })

    const data = await res.json() as FmpActive[]
    cache = { data: data.slice(0, 15), expires: Date.now() + CACHE_TTL }
    return NextResponse.json({ actives: cache.data })
  } catch {
    return NextResponse.json({ actives: [] })
  }
}
```

- [ ] **Step 6: market/themes/route.ts 구현 (정적 데이터)**

```typescript
// src/app/api/market/themes/route.ts
import { NextResponse } from 'next/server'

const THEMES = [
  { id: 'ai', name: 'AI', tickers: ['NVDA', 'MSFT', 'GOOGL', 'META', 'AMD', 'SMCI'] },
  { id: 'semiconductor', name: '반도체', tickers: ['INTC', 'AMD', 'NVDA', 'QCOM', 'AVGO', 'MU'] },
  { id: 'ev', name: '전기차', tickers: ['TSLA', 'RIVN', 'LCID', 'NIO', 'F', 'GM'] },
  { id: 'dividend', name: '배당주', tickers: ['JNJ', 'KO', 'PG', 'T', 'VZ', 'MO'] },
  { id: 'cloud', name: '클라우드', tickers: ['AMZN', 'MSFT', 'GOOGL', 'CRM', 'SNOW', 'DDOG'] },
  { id: 'fintech', name: '핀테크', tickers: ['SQ', 'PYPL', 'V', 'MA', 'COIN', 'AFRM'] },
]

export async function GET() {
  return NextResponse.json({ themes: THEMES })
}
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
npx jest search.test actives.test
```

Expected: PASS — 5 tests

- [ ] **Step 8: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (96+ tests)

- [ ] **Step 9: 커밋**

```bash
git add src/app/api/search/ src/app/api/market/ __tests__/app/api/search.test.ts __tests__/app/api/market/
git commit -m "Feat: add stock search, market actives, and themes APIs"
```

---

## Task 3: 종목 탐색 페이지 UI

**Files:**
- Create: `src/components/explore/SearchBar.tsx`
- Create: `src/components/explore/ActivesList.tsx`
- Create: `src/components/explore/ThemeGrid.tsx`
- Create: `src/components/explore/WatchlistSection.tsx`
- Modify: `src/app/explore/page.tsx`

- [ ] **Step 1: SearchBar.tsx 작성**

```typescript
// src/components/explore/SearchBar.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface SearchResult {
  symbol: string
  name: string
  exchange: string
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }

    timerRef.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { setResults(d.results ?? []); setOpen(true) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 300)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  const go = (symbol: string) => {
    setQuery('')
    setOpen(false)
    router.push(`/stock/${symbol}`)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2.5">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목 검색 (예: AAPL, Apple)"
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
        />
        {loading && <span className="text-gray-500 text-xs">...</span>}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setOpen(false) }}>
            <X size={14} className="text-gray-500" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-xl overflow-hidden z-50 shadow-lg">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => go(r.symbol)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-left border-b border-gray-700 last:border-0"
            >
              <span className="text-white font-semibold text-sm w-16 shrink-0">{r.symbol}</span>
              <span className="text-gray-400 text-xs truncate">{r.name}</span>
              <span className="text-gray-600 text-[10px] ml-auto">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-xl px-4 py-3 z-50">
          <p className="text-gray-500 text-sm">검색 결과가 없습니다.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ActivesList.tsx 작성**

```typescript
// src/components/explore/ActivesList.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Active {
  symbol: string
  name: string
  changesPercentage: number
  price: number
}

export default function ActivesList() {
  const [actives, setActives] = useState<Active[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/market/actives')
      .then((r) => r.json())
      .then((d) => setActives(d.actives ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-40 bg-gray-800 rounded-xl" />

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <p className="text-gray-400 text-xs uppercase tracking-wide px-4 py-3 border-b border-gray-800">
        인기 종목
      </p>
      {actives.slice(0, 8).map((a) => {
        const isUp = a.changesPercentage >= 0
        return (
          <button
            key={a.symbol}
            onClick={() => router.push(`/stock/${a.symbol}`)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800"
          >
            <div className="text-left">
              <p className="text-white text-sm font-semibold">{a.symbol}</p>
              <p className="text-xs text-gray-400 truncate max-w-[160px]">{a.name}</p>
            </div>
            <div className="text-right">
              <p className="text-white text-sm">${a.price.toFixed(2)}</p>
              <p className={`text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{a.changesPercentage.toFixed(2)}%
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: ThemeGrid.tsx 작성**

```typescript
// src/components/explore/ThemeGrid.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Theme {
  id: string
  name: string
  tickers: string[]
}

export default function ThemeGrid() {
  const [themes, setThemes] = useState<Theme[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/market/themes')
      .then((r) => r.json())
      .then((d) => setThemes(d.themes ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-2">
      <p className="text-gray-400 text-xs uppercase tracking-wide">테마별 종목</p>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((theme) => (
          <div key={theme.id} className="bg-gray-900 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === theme.id ? null : theme.id)}
              className="w-full p-3 text-left"
            >
              <p className="text-white text-sm font-semibold">{theme.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{theme.tickers.length}개 종목</p>
            </button>
            {expanded === theme.id && (
              <div className="border-t border-gray-800 p-2 flex flex-wrap gap-1">
                {theme.tickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => router.push(`/stock/${t}`)}
                    className="text-[11px] bg-gray-800 text-blue-400 px-2 py-1 rounded-lg font-medium"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: WatchlistSection.tsx 작성**

```typescript
// src/components/explore/WatchlistSection.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus } from 'lucide-react'

export default function WatchlistSection() {
  const [tickers, setTickers] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const router = useRouter()

  const load = () =>
    fetch('/api/watchlist').then((r) => r.json()).then((d) => setTickers(d.tickers ?? []))

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!input.trim()) return
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: input.trim().toUpperCase() }),
    })
    setInput('')
    setAdding(false)
    load()
  }

  const remove = async (ticker: string) => {
    await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-xs uppercase tracking-wide">관심종목</p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-blue-400 p-1"
        >
          <Plus size={16} />
        </button>
      </div>

      {adding && (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="티커 입력 (예: NVDA)"
            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
            autoFocus
          />
          <button
            onClick={add}
            disabled={!input.trim()}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40"
          >
            추가
          </button>
        </div>
      )}

      {tickers.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          관심종목을 추가해 보세요.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tickers.map((t) => (
            <div
              key={t}
              className="flex items-center gap-1.5 bg-gray-900 rounded-lg px-3 py-2"
            >
              <button
                onClick={() => router.push(`/stock/${t}`)}
                className="text-white text-sm font-semibold"
              >
                {t}
              </button>
              <button onClick={() => remove(t)} className="text-gray-500 hover:text-red-400">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: explore/page.tsx 전체 교체**

```typescript
// src/app/explore/page.tsx
import TopBar from '@/components/layout/TopBar'
import SearchBar from '@/components/explore/SearchBar'
import ActivesList from '@/components/explore/ActivesList'
import ThemeGrid from '@/components/explore/ThemeGrid'
import WatchlistSection from '@/components/explore/WatchlistSection'

export default function ExplorePage() {
  return (
    <>
      <TopBar title="종목 탐색" />
      <div className="p-4 space-y-6">
        <SearchBar />
        <WatchlistSection />
        <ThemeGrid />
        <ActivesList />
      </div>
    </>
  )
}
```

- [ ] **Step 6: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/components/explore/ src/app/explore/page.tsx
git commit -m "Feat: add explore page (search, watchlist, themes, active stocks)"
```

---

## Task 4: 대시보드 홈 페이지

**Files:**
- Create: `src/components/dashboard/HoldingsMini.tsx`
- Create: `src/components/dashboard/FxPnlMini.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: HoldingsMini.tsx 작성**

```typescript
// src/components/dashboard/HoldingsMini.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Position {
  ticker: string
  currentPrice: number
  currentValue: number
  unrealizedPLPct: number
}

export default function HoldingsMini() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((d) => setPositions(d.positions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />
  if (positions.length === 0) return null

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <p className="text-gray-400 text-xs uppercase tracking-wide px-4 py-2.5 border-b border-gray-800">
        보유 종목
      </p>
      {positions.slice(0, 3).map((p) => {
        const isUp = p.unrealizedPLPct >= 0
        return (
          <button
            key={p.ticker}
            onClick={() => router.push(`/stock/${p.ticker}`)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800"
          >
            <p className="text-white font-semibold text-sm">{p.ticker}</p>
            <div className="text-right">
              <p className="text-white text-sm">${p.currentValue.toFixed(2)}</p>
              <p className={`text-xs ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{p.unrealizedPLPct.toFixed(2)}%
              </p>
            </div>
          </button>
        )
      })}
      {positions.length > 3 && (
        <button
          onClick={() => router.push('/portfolio')}
          className="w-full py-2.5 text-xs text-blue-400 text-center"
        >
          전체 {positions.length}개 보기
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: FxPnlMini.tsx 작성**

```typescript
// src/components/dashboard/FxPnlMini.tsx
'use client'

import { useEffect, useState } from 'react'

interface FxRecord {
  krwAmount: number
}

export default function FxPnlMini() {
  const [invested, setInvested] = useState<number | null>(null)
  const [krwValue, setKrwValue] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/fx-records').then((r) => r.json()),
      fetch('/api/exchange-rate').then((r) => r.json()),
      fetch('/api/account').then((r) => r.json()),
    ])
      .then(([fxData, rateData, accountData]) => {
        const inv = (fxData.records as FxRecord[]).reduce((s, r) => s + r.krwAmount, 0)
        const equity = parseFloat(accountData.equity ?? '0')
        setInvested(inv)
        setKrwValue(equity * (rateData.rate ?? 1300))
      })
      .catch(() => {})
  }, [])

  if (invested === null || krwValue === null) return null
  if (invested === 0) return null

  const pnl = krwValue - invested
  const isUp = pnl >= 0
  const fmt = (v: number) => v.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' })

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-xs">환차익/손실</p>
        <p className={`text-sm font-semibold mt-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{fmt(Math.round(pnl))}
        </p>
      </div>
      <div className="text-right">
        <p className="text-gray-400 text-xs">투입 원화</p>
        <p className="text-gray-300 text-sm">{fmt(Math.round(invested))}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 홈 페이지(page.tsx) 업데이트**

`src/app/page.tsx`를 아래로 교체:

```typescript
// src/app/page.tsx
import TopBar from '@/components/layout/TopBar'
import AccountSummary from '@/components/account/AccountSummary'
import HoldingsMini from '@/components/dashboard/HoldingsMini'
import FxPnlMini from '@/components/dashboard/FxPnlMini'

export default function HomePage() {
  return (
    <>
      <TopBar title="홈" />
      <div className="p-4 space-y-4">
        <AccountSummary />
        <HoldingsMini />
        <FxPnlMini />
      </div>
    </>
  )
}
```

- [ ] **Step 4: 전체 테스트 최종 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (100+ tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/dashboard/ src/app/page.tsx
git commit -m "Feat: assemble dashboard home page (account, holdings, FX P&L)"
```

---

## Phase 8 완료 기준 = 전체 앱 완성

- [ ] `npx jest` → 모든 테스트 PASS
- [ ] 탐색 탭 → 종목 검색 → 종목 상세로 이동
- [ ] 관심종목 추가/제거 동작
- [ ] 테마 카드 클릭 → 해당 종목 링크
- [ ] 홈 탭 → 총 자산 + 보유 종목 + 환차익 표시

## 🎉 프로젝트 완료

Phase 1-8 모두 완성:

| Phase | 완료 내용 |
|-------|---------|
| 1 | Foundation (Next.js, DB, Alpaca 클라이언트, 서버, 네비게이션) |
| 2 | 실시간 시세 + 종목 상세 (차트, 호가창, 배당) |
| 3 | Lot 추적 + 포트폴리오 (카테고리, 파이차트) |
| 4 | 주문 + 정기 투자 (시장가/지정가, Lot 선택, Cron) |
| 5 | 자동 전략 (룰 기반 자동 매도, 백그라운드 모니터링) |
| 6 | 환전 추적 + 세금 (Wise CSV, 환차익, Excel 신고서) |
| 7 | 알림 Web Push (목표가, 체결, 전략 알림) |
| 8 | 종목 탐색 + 대시보드 |
