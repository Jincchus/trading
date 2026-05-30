# Stock Trading App — Phase 3: Lot 추적 + 포트폴리오

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alpaca 체결 주문을 DB Lot으로 동기화하고, 포트폴리오 현황(Lot별 P&L, 카테고리별 분류, 파이차트)을 보여주는 포트폴리오 페이지와 카테고리 설정 UI 완성

**Architecture:** POST /api/portfolio/sync가 Alpaca filled 매수 주문을 읽어 DB Lot으로 upsert. GET /api/portfolio가 Alpaca 현재 포지션(가격)과 DB Lot(취득가·카테고리)을 합쳐 반환. Category는 ticker와 M:N 관계로 DB에 저장.

**Tech Stack:** Prisma (SQLite), Next.js API Routes, SVG 파이차트 (추가 라이브러리 없음), Tailwind CSS

---

## 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── portfolio/
│   │   │   ├── route.ts                         # GET /api/portfolio
│   │   │   └── sync/route.ts                    # POST /api/portfolio/sync
│   │   ├── categories/
│   │   │   ├── route.ts                         # GET/POST /api/categories
│   │   │   └── [id]/route.ts                    # PUT/DELETE /api/categories/[id]
│   │   └── stocks/[ticker]/categories/
│   │       ├── route.ts                         # GET/POST
│   │       └── [categoryId]/route.ts            # DELETE
│   ├── portfolio/
│   │   └── page.tsx                             # 포트폴리오 페이지 (scaffold 교체)
│   └── settings/
│       └── page.tsx                             # 설정 페이지 (CategoryManager 추가)
├── components/
│   ├── portfolio/
│   │   ├── PortfolioSummary.tsx                 # 총 자산 + 미실현 손익
│   │   ├── PositionCard.tsx                     # 종목별 카드 (Lot 펼치기)
│   │   ├── LotRow.tsx                           # 개별 Lot 행
│   │   ├── PieChart.tsx                         # SVG 파이차트
│   │   └── CategoryTabs.tsx                     # 카테고리 탭 필터
│   └── settings/
│       └── CategoryManager.tsx                  # 카테고리 CRUD UI
└── lib/
    └── alpaca/
        └── client.ts                            # 수정: getOrders에 side 파라미터 추가
__tests__/
└── app/api/
    ├── portfolio/
    │   ├── sync.test.ts
    │   └── portfolio.test.ts
    ├── categories/
    │   ├── categories.test.ts
    │   └── categories-id.test.ts
    └── stocks/
        └── stock-categories.test.ts
```

---

## Task 1: Alpaca getOrders 확장 + Portfolio Sync API

**Files:**
- Modify: `src/lib/alpaca/client.ts`
- Create: `src/app/api/portfolio/sync/route.ts`
- Create: `__tests__/app/api/portfolio/sync.test.ts`

- [ ] **Step 1: client.ts getOrders 타입에 side 추가**

`getOrders` 반환 메서드의 파라미터 타입을 찾아 수정:
```typescript
getOrders: (params?: { status?: string; limit?: number; side?: 'buy' | 'sell' }): Promise<AlpacaOrder[]> => {
```
(나머지 구현은 그대로 유지)

- [ ] **Step 2: 테스트 작성**

```typescript
// __tests__/app/api/portfolio/sync.test.ts
import { POST } from '@/app/api/portfolio/sync/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getOrders: jest.fn().mockResolvedValue([
      {
        id: 'order-1', symbol: 'AAPL', filled_qty: '10',
        filled_avg_price: '150.00', filled_at: '2024-01-15T14:30:00Z',
        side: 'buy', status: 'filled', qty: '10', type: 'market',
        filled_qty: '10', extended_hours: false,
      },
      {
        id: 'order-2', symbol: 'MSFT', filled_qty: '5',
        filled_avg_price: '380.00', filled_at: '2024-01-16T14:30:00Z',
        side: 'buy', status: 'filled', qty: '5', type: 'market',
        extended_hours: false,
      },
      {
        id: 'order-3', symbol: 'AAPL', filled_qty: '0',
        filled_avg_price: null, filled_at: null,
        side: 'sell', status: 'filled', qty: '5', type: 'market',
        extended_hours: false,
      },
    ]),
  },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('POST syncs only filled buy orders', async () => {
  const res = await POST()
  const data = await res.json()
  expect(data.synced).toBe(2)
})

test('POST upserts with correct lot data', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.upsert.mockClear()
  await POST()
  expect(prisma.lot.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { alpacaOrderId: 'order-1' },
      create: expect.objectContaining({
        ticker: 'AAPL',
        quantity: 10,
        purchasePrice: 150,
      }),
    })
  )
})

test('POST returns 502 on Alpaca error', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getOrders.mockRejectedValueOnce(new Error('Network error'))
  const res = await POST()
  expect(res.status).toBe(502)
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npx jest sync.test
```

Expected: FAIL — `Cannot find module '@/app/api/portfolio/sync/route'`

- [ ] **Step 4: sync/route.ts 구현**

```typescript
// src/app/api/portfolio/sync/route.ts
import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    const orders = await alpaca.getOrders({ status: 'filled', limit: 500 })
    const buyOrders = orders.filter(
      (o) => o.side === 'buy' && o.filled_qty && o.filled_avg_price && o.filled_at
    )

    await Promise.all(
      buyOrders.map((order) =>
        prisma.lot.upsert({
          where: { alpacaOrderId: order.id },
          update: {},
          create: {
            ticker: order.symbol,
            quantity: parseFloat(order.filled_qty),
            purchasePrice: parseFloat(order.filled_avg_price!),
            purchaseDate: new Date(order.filled_at!),
            alpacaOrderId: order.id,
          },
        })
      )
    )

    return NextResponse.json({ synced: buyOrders.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest sync.test
```

Expected: PASS — 3 tests

- [ ] **Step 6: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/alpaca/client.ts src/app/api/portfolio/sync/ __tests__/app/api/portfolio/sync.test.ts
git commit -m "Feat: add portfolio sync API (Alpaca orders → DB Lots)"
```

---

## Task 2: Portfolio Data API

**Files:**
- Create: `src/app/api/portfolio/route.ts`
- Create: `__tests__/app/api/portfolio/portfolio.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/portfolio/portfolio.test.ts
import { GET } from '@/app/api/portfolio/route'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getPositions: jest.fn().mockResolvedValue([
      {
        symbol: 'AAPL',
        qty: '10',
        current_price: '175.00',
        unrealized_pl: '250.00',
        unrealized_plpc: '0.1667',
        avg_entry_price: '150.00',
      },
    ]),
  },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'lot-1',
          ticker: 'AAPL',
          quantity: 10,
          soldQuantity: 0,
          purchasePrice: 150,
          purchaseDate: new Date('2024-01-15'),
          status: 'active',
          strategyId: null,
        },
      ]),
    },
    stockCategory: {
      findMany: jest.fn().mockResolvedValue([
        {
          ticker: 'AAPL',
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'AI', color: '#3b82f6' },
        },
      ]),
    },
  },
}))

test('GET returns enriched portfolio positions', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.positions).toHaveLength(1)
  expect(data.positions[0].ticker).toBe('AAPL')
  expect(data.positions[0].currentPrice).toBe(175)
  expect(data.positions[0].categories).toContain('AI')
})

test('GET calculates lot-level P&L correctly', async () => {
  const res = await GET()
  const data = await res.json()
  const lot = data.positions[0].lots[0]
  expect(lot.unrealizedPL).toBeCloseTo(250, 1)
  expect(lot.unrealizedPLPct).toBeCloseTo(16.67, 1)
})

test('GET calculates total portfolio value', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.totalValue).toBeCloseTo(1750, 0)
  expect(data.totalUnrealizedPL).toBeCloseTo(250, 0)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest portfolio.test
```

Expected: FAIL

- [ ] **Step 3: portfolio/route.ts 구현**

```typescript
// src/app/api/portfolio/route.ts
import { NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const [alpacaPositions, dbLots, stockCategories] = await Promise.all([
      alpaca.getPositions(),
      prisma.lot.findMany({ where: { status: 'active' } }),
      prisma.stockCategory.findMany({ include: { category: true } }),
    ])

    const lotsByTicker = new Map<string, typeof dbLots>()
    for (const lot of dbLots) {
      if (!lotsByTicker.has(lot.ticker)) lotsByTicker.set(lot.ticker, [])
      lotsByTicker.get(lot.ticker)!.push(lot)
    }

    const categoryNamesByTicker = new Map<string, string[]>()
    for (const sc of stockCategories) {
      if (!categoryNamesByTicker.has(sc.ticker)) categoryNamesByTicker.set(sc.ticker, [])
      categoryNamesByTicker.get(sc.ticker)!.push(sc.category.name)
    }

    const positions = alpacaPositions.map((pos) => {
      const currentPrice = parseFloat(pos.current_price)
      const qty = parseFloat(pos.qty)

      const lots = (lotsByTicker.get(pos.symbol) ?? []).map((lot) => {
        const remaining = lot.quantity - lot.soldQuantity
        const pl = (currentPrice - lot.purchasePrice) * remaining
        const plPct = lot.purchasePrice > 0
          ? ((currentPrice - lot.purchasePrice) / lot.purchasePrice) * 100
          : 0
        return {
          id: lot.id,
          quantity: lot.quantity,
          remainingQty: remaining,
          purchasePrice: lot.purchasePrice,
          purchaseDate: lot.purchaseDate.toISOString(),
          currentValue: remaining * currentPrice,
          unrealizedPL: pl,
          unrealizedPLPct: plPct,
          status: lot.status,
          strategyId: lot.strategyId,
        }
      })

      return {
        ticker: pos.symbol,
        qty,
        currentPrice,
        currentValue: qty * currentPrice,
        unrealizedPL: parseFloat(pos.unrealized_pl),
        unrealizedPLPct: parseFloat(pos.unrealized_plpc) * 100,
        lots,
        categories: categoryNamesByTicker.get(pos.symbol) ?? [],
      }
    })

    const totalValue = positions.reduce((s, p) => s + p.currentValue, 0)
    const totalUnrealizedPL = positions.reduce((s, p) => s + p.unrealizedPL, 0)

    return NextResponse.json({ positions, totalValue, totalUnrealizedPL })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch portfolio'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest portfolio.test
```

Expected: PASS — 3 tests

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/portfolio/route.ts __tests__/app/api/portfolio/portfolio.test.ts
git commit -m "Feat: add portfolio data API (positions + lots + categories)"
```

---

## Task 3: Category CRUD API

**Files:**
- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/categories/[id]/route.ts`
- Create: `__tests__/app/api/categories/categories.test.ts`
- Create: `__tests__/app/api/categories/categories-id.test.ts`

- [ ] **Step 1: 테스트 작성 (categories/route.ts)**

```typescript
// __tests__/app/api/categories/categories.test.ts
import { GET, POST } from '@/app/api/categories/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    category: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'cat-1', name: 'AI', color: '#3b82f6' },
        { id: 'cat-2', name: '배당주', color: '#22c55e' },
      ]),
      create: jest.fn().mockResolvedValue({ id: 'cat-3', name: '성장주', color: '#f59e0b' }),
    },
  },
}))

test('GET returns all categories', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.categories).toHaveLength(2)
  expect(data.categories[0].name).toBe('AI')
})

test('POST creates new category', async () => {
  const req = new NextRequest('http://localhost/api/categories', {
    method: 'POST',
    body: JSON.stringify({ name: '성장주', color: '#f59e0b' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.category.name).toBe('성장주')
})

test('POST returns 400 for missing name', async () => {
  const req = new NextRequest('http://localhost/api/categories', {
    method: 'POST',
    body: JSON.stringify({ color: '#3b82f6' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: 테스트 작성 (categories/[id]/route.ts)**

```typescript
// __tests__/app/api/categories/categories-id.test.ts
import { PUT, DELETE } from '@/app/api/categories/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    category: {
      update: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Updated', color: '#ef4444' }),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('PUT updates category', async () => {
  const req = new NextRequest('http://localhost/api/categories/cat-1', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Updated', color: '#ef4444' }),
  })
  const res = await PUT(req, { params: Promise.resolve({ id: 'cat-1' }) })
  const data = await res.json()
  expect(data.category.name).toBe('Updated')
})

test('DELETE removes category', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'cat-1' }) })
  const data = await res.json()
  expect(data.ok).toBe(true)
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npx jest categories.test categories-id.test
```

Expected: FAIL

- [ ] **Step 4: categories/route.ts 구현**

```typescript
// src/app/api/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; color?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const category = await prisma.category.create({
      data: { name: body.name.trim(), color: body.color ?? '#3b82f6' },
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create category'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: categories/[id]/route.ts 구현**

```typescript
// src/app/api/categories/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { name?: string; color?: string }
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.color && { color: body.color }),
      },
    })
    return NextResponse.json({ category })
  } catch {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx jest categories.test categories-id.test
```

Expected: PASS — 5 tests

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/categories/ __tests__/app/api/categories/
git commit -m "Feat: add category CRUD API"
```

---

## Task 4: Stock-Category 할당 API

**Files:**
- Create: `src/app/api/stocks/[ticker]/categories/route.ts`
- Create: `src/app/api/stocks/[ticker]/categories/[categoryId]/route.ts`
- Create: `__tests__/app/api/stocks/stock-categories.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/stocks/stock-categories.test.ts
import { GET, POST } from '@/app/api/stocks/[ticker]/categories/route'
import { DELETE } from '@/app/api/stocks/[ticker]/categories/[categoryId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    stockCategory: {
      findMany: jest.fn().mockResolvedValue([
        { ticker: 'AAPL', categoryId: 'cat-1', category: { id: 'cat-1', name: 'AI', color: '#3b82f6' } },
      ]),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('GET returns categories for ticker', async () => {
  const res = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ ticker: 'AAPL' }) })
  const data = await res.json()
  expect(data.categories).toHaveLength(1)
  expect(data.categories[0].name).toBe('AI')
})

test('POST assigns category to ticker (uppercased)', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ categoryId: 'cat-1' }),
  })
  await POST(req, { params: Promise.resolve({ ticker: 'aapl' }) })
  expect(prisma.stockCategory.create).toHaveBeenCalledWith({
    data: { ticker: 'AAPL', categoryId: 'cat-1' },
  })
})

test('DELETE removes category from ticker', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ ticker: 'AAPL', categoryId: 'cat-1' }),
  })
  const data = await res.json()
  expect(data.ok).toBe(true)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest stock-categories.test
```

Expected: FAIL

- [ ] **Step 3: stocks/[ticker]/categories/route.ts 구현**

```typescript
// src/app/api/stocks/[ticker]/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const assignments = await prisma.stockCategory.findMany({
    where: { ticker: ticker.toUpperCase() },
    include: { category: true },
  })
  return NextResponse.json({ categories: assignments.map((a) => a.category) })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const { categoryId } = await req.json() as { categoryId: string }
    await prisma.stockCategory.create({
      data: { ticker: ticker.toUpperCase(), categoryId },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Assignment already exists or invalid' }, { status: 409 })
  }
}
```

- [ ] **Step 4: stocks/[ticker]/categories/[categoryId]/route.ts 구현**

```typescript
// src/app/api/stocks/[ticker]/categories/[categoryId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string; categoryId: string }> }
) {
  try {
    const { ticker, categoryId } = await params
    await prisma.stockCategory.delete({
      where: { ticker_categoryId: { ticker: ticker.toUpperCase(), categoryId } },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest stock-categories.test
```

Expected: PASS — 3 tests

- [ ] **Step 6: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (29+ tests)

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/stocks/[ticker]/categories/ __tests__/app/api/stocks/stock-categories.test.ts
git commit -m "Feat: add stock-category assignment API"
```

---

## Task 5: Portfolio UI 컴포넌트 (PortfolioSummary, PositionCard, LotRow)

**Files:**
- Create: `src/components/portfolio/PortfolioSummary.tsx`
- Create: `src/components/portfolio/PositionCard.tsx`
- Create: `src/components/portfolio/LotRow.tsx`

- [ ] **Step 1: PortfolioSummary.tsx 작성**

```typescript
// src/components/portfolio/PortfolioSummary.tsx
interface Props {
  totalValue: number
  totalUnrealizedPL: number
}

export default function PortfolioSummary({ totalValue, totalUnrealizedPL }: Props) {
  const isUp = totalUnrealizedPL >= 0
  const cost = totalValue - totalUnrealizedPL
  const pct = cost > 0 ? (totalUnrealizedPL / cost) * 100 : 0

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">총 자산</p>
      <p className="text-3xl font-bold text-white">{fmt(totalValue)}</p>
      <p className={`text-sm mt-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
        {isUp ? '+' : ''}{fmt(totalUnrealizedPL)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
      </p>
    </div>
  )
}
```

- [ ] **Step 2: LotRow.tsx 작성**

```typescript
// src/components/portfolio/LotRow.tsx
interface LotDetail {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  unrealizedPL: number
  unrealizedPLPct: number
  status: string
}

export default function LotRow({ lot }: { lot: LotDetail }) {
  const isUp = lot.unrealizedPL >= 0
  const date = lot.purchaseDate.slice(0, 10)

  return (
    <div className="px-4 py-3 flex justify-between items-center border-b border-gray-800 last:border-0 bg-gray-950">
      <div>
        <p className="text-xs text-gray-300">{date}</p>
        <p className="text-xs text-gray-500">
          {lot.remainingQty}주 · 취득가 ${lot.purchasePrice.toFixed(2)}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{lot.unrealizedPLPct.toFixed(2)}%
        </p>
        <p className={`text-xs ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}${lot.unrealizedPL.toFixed(2)}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: PositionCard.tsx 작성**

```typescript
// src/components/portfolio/PositionCard.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import LotRow from './LotRow'

interface LotDetail {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  status: string
  strategyId: string | null
}

interface Props {
  ticker: string
  qty: number
  currentPrice: number
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  lots: LotDetail[]
  categories: string[]
}

export default function PositionCard(props: Props) {
  const [expanded, setExpanded] = useState(false)
  const isUp = props.unrealizedPL >= 0

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-base">{props.ticker}</p>
              {expanded
                ? <ChevronUp size={14} className="text-gray-500" />
                : <ChevronDown size={14} className="text-gray-500" />}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {props.qty}주 · ${props.currentPrice.toFixed(2)}
            </p>
            {props.categories.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {props.categories.map((c) => (
                  <span
                    key={c}
                    className="text-[10px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded-full"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-white font-semibold">
              ${props.currentValue.toFixed(2)}
            </p>
            <p className={`text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{props.unrealizedPLPct.toFixed(2)}%
            </p>
          </div>
        </div>
      </button>

      {expanded && props.lots.length > 0 && (
        <div className="border-t border-gray-800">
          {props.lots.map((lot) => (
            <LotRow key={lot.id} lot={lot} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/portfolio/PortfolioSummary.tsx src/components/portfolio/PositionCard.tsx src/components/portfolio/LotRow.tsx
git commit -m "Feat: add PortfolioSummary, PositionCard, LotRow components"
```

---

## Task 6: PieChart + CategoryTabs 컴포넌트

**Files:**
- Create: `src/components/portfolio/PieChart.tsx`
- Create: `src/components/portfolio/CategoryTabs.tsx`

- [ ] **Step 1: PieChart.tsx 작성 (SVG 기반, 추가 라이브러리 없음)**

```typescript
// src/components/portfolio/PieChart.tsx
interface PieSlice {
  label: string
  value: number
  color: string
}

export default function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  let angle = -Math.PI / 2
  const paths = slices.map((slice) => {
    const sweep = (slice.value / total) * 2 * Math.PI
    const x1 = 50 + 40 * Math.cos(angle)
    const y1 = 50 + 40 * Math.sin(angle)
    angle += sweep
    const x2 = 50 + 40 * Math.cos(angle)
    const y2 = 50 + 40 * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M50 50 L${x1.toFixed(1)} ${y1.toFixed(1)} A40 40 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z`
    return { ...slice, d, pct: (slice.value / total) * 100 }
  })

  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-36 h-36 mx-auto">
        {paths.map((p) => <path key={p.label} d={p.d} fill={p.color} />)}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-3">
        {paths.map((p) => (
          <div key={p.label} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-[11px] text-gray-400">
              {p.label} {p.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CategoryTabs.tsx 작성**

```typescript
// src/components/portfolio/CategoryTabs.tsx
'use client'

interface Tab {
  id: string
  label: string
}

interface Props {
  tabs: Tab[]
  activeTab: string
  onSelect: (id: string) => void
}

export default function CategoryTabs({ tabs, activeTab, onSelect }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: globals.css에 no-scrollbar 유틸리티 추가**

`src/app/globals.css` 하단에 추가:
```css
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

- [ ] **Step 4: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/portfolio/PieChart.tsx src/components/portfolio/CategoryTabs.tsx src/app/globals.css
git commit -m "Feat: add SVG PieChart and CategoryTabs components"
```

---

## Task 7: 포트폴리오 페이지 조립

**Files:**
- Modify: `src/app/portfolio/page.tsx`

- [ ] **Step 1: portfolio/page.tsx 전체 교체**

```typescript
// src/app/portfolio/page.tsx
'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import PortfolioSummary from '@/components/portfolio/PortfolioSummary'
import PositionCard from '@/components/portfolio/PositionCard'
import PieChart from '@/components/portfolio/PieChart'
import CategoryTabs from '@/components/portfolio/CategoryTabs'

interface LotDetail {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  status: string
  strategyId: string | null
}

interface Position {
  ticker: string
  qty: number
  currentPrice: number
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  lots: LotDetail[]
  categories: string[]
}

interface PortfolioData {
  positions: Position[]
  totalValue: number
  totalUnrealizedPL: number
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(false)

  const load = () =>
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true))

  useEffect(() => { load() }, [])

  const sync = async () => {
    setSyncing(true)
    await fetch('/api/portfolio/sync', { method: 'POST' }).catch(() => {})
    await load()
    setSyncing(false)
  }

  const allCategories = [...new Set((data?.positions ?? []).flatMap((p) => p.categories))]
  const tabs = [{ id: 'all', label: '전체' }, ...allCategories.map((c) => ({ id: c, label: c }))]

  const filtered =
    activeTab === 'all'
      ? (data?.positions ?? [])
      : (data?.positions ?? []).filter((p) => p.categories.includes(activeTab))

  const pieSlices = (data?.positions ?? []).map((p, i) => ({
    label: p.ticker,
    value: p.currentValue,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <>
      <TopBar title="포트폴리오" />
      <div className="p-4 space-y-4">
        {data ? (
          <PortfolioSummary totalValue={data.totalValue} totalUnrealizedPL={data.totalUnrealizedPL} />
        ) : error ? (
          <p className="text-red-400 text-sm p-4">포트폴리오를 불러올 수 없습니다.</p>
        ) : (
          <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />
        )}

        <button
          onClick={sync}
          disabled={syncing}
          className="w-full py-2.5 text-sm text-blue-400 border border-blue-900 rounded-xl disabled:opacity-50 transition-opacity"
        >
          {syncing ? '동기화 중...' : 'Alpaca 주문 동기화'}
        </button>

        {data && data.positions.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4">
            <PieChart slices={pieSlices} />
          </div>
        )}

        {tabs.length > 1 && (
          <CategoryTabs tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} />
        )}

        <div className="space-y-3">
          {filtered.map((pos) => (
            <PositionCard key={pos.ticker} {...pos} />
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">
              {data
                ? '이 카테고리에 포지션이 없습니다.'
                : '로딩 중...'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/portfolio/page.tsx
git commit -m "Feat: assemble portfolio page (sync, positions, lots, categories, pie chart)"
```

---

## Task 8: 설정 페이지 CategoryManager

**Files:**
- Create: `src/components/settings/CategoryManager.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: CategoryManager.tsx 작성**

```typescript
// src/components/settings/CategoryManager.tsx
'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

const PRESET_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

interface Category {
  id: string
  name: string
  color: string
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  const load = () =>
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!name.trim()) return
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color }),
    })
    setName('')
    load()
  }

  const remove = async (id: string) => {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4">카테고리 관리</h3>

      <div className="flex gap-2 mb-3">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${
              color === c ? 'border-white scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="카테고리 이름 (예: 배당주)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40 transition-opacity"
        >
          추가
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">카테고리가 없습니다.</p>
      ) : (
        <div className="space-y-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-white text-sm flex-1">{cat.name}</span>
              <button
                onClick={() => remove(cat.id)}
                className="text-gray-500 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: settings/page.tsx 업데이트**

```typescript
// src/app/settings/page.tsx
import TopBar from '@/components/layout/TopBar'
import CategoryManager from '@/components/settings/CategoryManager'

export default function SettingsPage() {
  return (
    <>
      <TopBar title="설정" />
      <div className="p-4 space-y-4">
        <CategoryManager />
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">API 설정</p>
          <p className="text-gray-500 text-sm">Phase 5에서 완성</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">매매 전략</p>
          <p className="text-gray-500 text-sm">Phase 5에서 완성</p>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: 전체 테스트 최종 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add src/components/settings/CategoryManager.tsx src/app/settings/page.tsx
git commit -m "Feat: add CategoryManager UI and update settings page"
```

---

## Phase 3 완료 기준

- [ ] `npx jest` → 모든 테스트 PASS (29+ tests)
- [ ] Alpaca API 키 설정 후 포트폴리오 동기화 → 보유 종목 표시
- [ ] 종목 카드 클릭 → Lot별 수익률 펼치기 동작
- [ ] 설정 → 카테고리 추가·삭제 → 포트폴리오에서 카테고리 탭 표시

## 다음 단계

Phase 4 (주문 + 정기 투자) 계획을 작성하려면 요청하세요.
