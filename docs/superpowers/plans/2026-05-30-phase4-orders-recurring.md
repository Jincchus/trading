# Stock Trading App — Phase 4: 주문 + 정기 투자

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시장가/지정가 매수·매도 주문, Lot 선택 매도, 정기 자동 투자(Cron) 기능 완성

**Architecture:** Alpaca REST API로 주문 실행. 매수 즉시 체결 시 DB Lot 자동 생성, 매도 시 Lot.soldQuantity 업데이트. RecurringInvestment는 신규 Prisma 모델로 관리하며 서버 setInterval이 매분 체크 후 자동 매수 실행.

**Tech Stack:** Alpaca Markets API, Prisma + SQLite (RecurringInvestment 모델 추가), Next.js API Routes, Tailwind CSS

---

## 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── orders/
│   │   │   ├── route.ts                  # GET (내역) / POST (주문 실행)
│   │   │   └── [orderId]/route.ts        # DELETE (취소)
│   │   └── recurring/
│   │       ├── route.ts                  # GET / POST
│   │       └── [id]/route.ts             # PUT / DELETE
│   └── orders/
│       └── page.tsx                      # 주문 페이지 (scaffold 교체)
├── components/
│   ├── orders/
│   │   ├── OrderForm.tsx                 # 매수 주문 폼 (시장가/지정가)
│   │   ├── LotSelector.tsx               # 매도용 Lot 선택 + 수량 입력
│   │   ├── OrderHistory.tsx              # 주문 내역 목록
│   │   ├── RecurringForm.tsx             # 정기 투자 생성 폼
│   │   └── RecurringList.tsx             # 정기 투자 목록
│   └── stock/
│       └── TradePanel.tsx                # placeholder → 실제 매수/매도 버튼
├── lib/
│   └── recurring.ts                      # shouldRun 유틸 (서버 Job에서 사용)
└── server.ts                             # 수정: recurring 백그라운드 Job 추가
prisma/
└── schema.prisma                         # 수정: RecurringInvestment 모델 추가
__tests__/
└── app/api/
    ├── orders/
    │   ├── orders.test.ts
    │   └── orders-id.test.ts
    └── recurring/
        ├── recurring.test.ts
        └── recurring-id.test.ts
```

---

## Task 1: RecurringInvestment Prisma 스키마 추가

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: schema.prisma에 모델 추가**

`prisma/schema.prisma` 하단(AlertHistory 모델 아래)에 추가:

```prisma
model RecurringInvestment {
  id        String    @id @default(cuid())
  ticker    String
  amount    Float
  frequency String
  active    Boolean   @default(true)
  lastRun   DateTime?
  createdAt DateTime  @default(now())
}
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
npx prisma migrate dev --name add-recurring-investment
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: 테스트 확인 (기존 테스트 깨지지 않아야 함)**

```bash
npx jest
```

Expected: 35 tests PASS

- [ ] **Step 4: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "Feat: add RecurringInvestment model to Prisma schema"
```

---

## Task 2: Order 주문 실행 + 취소 API

**Files:**
- Create: `src/app/api/orders/route.ts` (POST only — GET은 Task 3)
- Create: `src/app/api/orders/[orderId]/route.ts`
- Create: `__tests__/app/api/orders/orders.test.ts`
- Create: `__tests__/app/api/orders/orders-id.test.ts`

- [ ] **Step 1: 테스트 작성 (주문 실행)**

```typescript
// __tests__/app/api/orders/orders.test.ts
import { POST } from '@/app/api/orders/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    placeOrder: jest.fn(),
    getOrders: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}))

function makePostReq(body: object) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockReset()
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.create.mockClear()
})

test('POST places market buy order', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-1',
    symbol: 'AAPL',
    side: 'buy',
    status: 'pending_new',
    qty: '10',
    filled_qty: '0',
    filled_avg_price: null,
    filled_at: null,
    type: 'market',
    extended_hours: false,
  })

  const res = await POST(makePostReq({ ticker: 'AAPL', side: 'buy', type: 'market', qty: 10 }))
  const data = await res.json()
  expect(res.status).toBe(201)
  expect(data.order.symbol).toBe('AAPL')
  expect(alpaca.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
    symbol: 'AAPL', side: 'buy', type: 'market',
  }))
})

test('POST creates Lot when market buy fills immediately', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-2',
    symbol: 'MSFT',
    side: 'buy',
    status: 'filled',
    qty: '5',
    filled_qty: '5',
    filled_avg_price: '380.00',
    filled_at: '2024-01-15T14:30:00Z',
    type: 'market',
    extended_hours: false,
  })

  const { prisma } = jest.requireMock('@/lib/db')
  await POST(makePostReq({ ticker: 'MSFT', side: 'buy', type: 'market', qty: 5 }))
  expect(prisma.lot.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ ticker: 'MSFT', quantity: 5, purchasePrice: 380 }),
  }))
})

test('POST updates Lot soldQuantity when sell fills', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-3',
    symbol: 'AAPL',
    side: 'sell',
    status: 'filled',
    qty: '3',
    filled_qty: '3',
    filled_avg_price: '175.00',
    filled_at: '2024-01-15T14:30:00Z',
    type: 'market',
    extended_hours: false,
  })

  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findUnique.mockResolvedValue({
    id: 'lot-1', quantity: 10, soldQuantity: 0, status: 'active',
  })

  await POST(makePostReq({ ticker: 'AAPL', side: 'sell', type: 'market', qty: 3, lotId: 'lot-1' }))
  expect(prisma.lot.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'lot-1' },
    data: expect.objectContaining({ soldQuantity: 3, status: 'active' }),
  }))
})

test('POST returns 502 on Alpaca error', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.placeOrder.mockRejectedValue(new Error('Insufficient funds'))
  const res = await POST(makePostReq({ ticker: 'AAPL', side: 'buy', type: 'market', qty: 1 }))
  expect(res.status).toBe(502)
})
```

- [ ] **Step 2: 테스트 작성 (주문 취소)**

```typescript
// __tests__/app/api/orders/orders-id.test.ts
import { DELETE } from '@/app/api/orders/[orderId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    cancelOrder: jest.fn().mockResolvedValue(undefined),
  },
}))

test('DELETE cancels order', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ orderId: 'order-1' }),
  })
  const data = await res.json()
  expect(data.ok).toBe(true)
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  expect(alpaca.cancelOrder).toHaveBeenCalledWith('order-1')
})

test('DELETE returns 502 on error', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.cancelOrder.mockRejectedValueOnce(new Error('Order already filled'))
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ orderId: 'bad-id' }),
  })
  expect(res.status).toBe(502)
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npx jest orders.test orders-id.test
```

Expected: FAIL

- [ ] **Step 4: orders/route.ts 구현 (POST만, GET은 Task 3)**

```typescript
// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      ticker: string
      side: 'buy' | 'sell'
      type: 'market' | 'limit'
      qty?: number
      notional?: number
      limitPrice?: number
      extendedHours?: boolean
      lotId?: string
    }

    const order = await alpaca.placeOrder({
      symbol: body.ticker.toUpperCase(),
      side: body.side,
      type: body.type,
      time_in_force: body.type === 'market' ? 'day' : 'gtc',
      ...(body.qty && { qty: String(body.qty) }),
      ...(body.notional && { notional: String(body.notional) }),
      ...(body.limitPrice && { limit_price: String(body.limitPrice) }),
      ...(body.extendedHours && { extended_hours: true }),
    })

    if (
      body.side === 'buy' &&
      order.status === 'filled' &&
      order.filled_avg_price &&
      order.filled_qty &&
      order.filled_at
    ) {
      await prisma.lot.create({
        data: {
          ticker: body.ticker.toUpperCase(),
          quantity: parseFloat(order.filled_qty),
          purchasePrice: parseFloat(order.filled_avg_price),
          purchaseDate: new Date(order.filled_at),
          alpacaOrderId: order.id,
        },
      })
    }

    if (
      body.side === 'sell' &&
      body.lotId &&
      order.status === 'filled' &&
      order.filled_qty
    ) {
      const filledQty = parseFloat(order.filled_qty)
      const lot = await prisma.lot.findUnique({ where: { id: body.lotId } })
      if (lot) {
        const newSold = lot.soldQuantity + filledQty
        await prisma.lot.update({
          where: { id: body.lotId },
          data: {
            soldQuantity: newSold,
            status: newSold >= lot.quantity ? 'fully_sold' : 'active',
          },
        })
      }
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Order failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 5: orders/[orderId]/route.ts 구현**

```typescript
// src/app/api/orders/[orderId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    await alpaca.cancelOrder(orderId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancel failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx jest orders.test orders-id.test
```

Expected: PASS — 6 tests

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/orders/ __tests__/app/api/orders/
git commit -m "Feat: add order placement and cancel API"
```

---

## Task 3: Order 내역 조회 API

**Files:**
- Modify: `src/app/api/orders/route.ts` (GET 추가)
- Create: `__tests__/app/api/orders/orders-get.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/orders/orders-get.test.ts
import { GET } from '@/app/api/orders/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getOrders: jest.fn().mockResolvedValue([
      {
        id: 'o-1', symbol: 'AAPL', side: 'buy', status: 'filled',
        qty: '10', filled_qty: '10', type: 'market',
        filled_avg_price: '150.00', filled_at: '2024-01-15T14:30:00Z',
        extended_hours: false,
      },
      {
        id: 'o-2', symbol: 'MSFT', side: 'buy', status: 'pending_new',
        qty: '5', filled_qty: '0', type: 'limit',
        filled_avg_price: null, filled_at: null,
        extended_hours: false,
      },
    ]),
  },
}))

function makeGetReq(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/orders')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

test('GET returns all recent orders', async () => {
  const res = await GET(makeGetReq())
  const data = await res.json()
  expect(data.orders).toHaveLength(2)
  expect(data.orders[0].symbol).toBe('AAPL')
})

test('GET passes status filter to Alpaca', async () => {
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await GET(makeGetReq({ status: 'open' }))
  expect(alpaca.getOrders).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'open' })
  )
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest orders-get.test
```

Expected: FAIL — GET not exported

- [ ] **Step 3: orders/route.ts에 GET 추가**

기존 POST 함수 위에 추가:

```typescript
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') ?? 'all'
    const orders = await alpaca.getOrders({ status, limit: 100 })
    return NextResponse.json({ orders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch orders'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest orders-get.test
```

Expected: PASS — 2 tests

- [ ] **Step 5: 전체 테스트 확인**

```bash
npx jest
```

Expected: 43 tests PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/orders/route.ts __tests__/app/api/orders/orders-get.test.ts
git commit -m "Feat: add order history API"
```

---

## Task 4: Recurring 투자 CRUD API

**Files:**
- Create: `src/app/api/recurring/route.ts`
- Create: `src/app/api/recurring/[id]/route.ts`
- Create: `__tests__/app/api/recurring/recurring.test.ts`
- Create: `__tests__/app/api/recurring/recurring-id.test.ts`

- [ ] **Step 1: 테스트 작성 (route.ts)**

```typescript
// __tests__/app/api/recurring/recurring.test.ts
import { GET, POST } from '@/app/api/recurring/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    recurringInvestment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'ri-1', ticker: 'AAPL', amount: 100, frequency: 'weekly', active: true, lastRun: null, createdAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue(
        { id: 'ri-2', ticker: 'MSFT', amount: 50, frequency: 'monthly', active: true, lastRun: null, createdAt: new Date() }
      ),
    },
  },
}))

test('GET returns recurring investments', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.recurring).toHaveLength(1)
  expect(data.recurring[0].ticker).toBe('AAPL')
})

test('POST creates recurring investment', async () => {
  const req = new NextRequest('http://localhost/api/recurring', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'MSFT', amount: 50, frequency: 'monthly' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.recurring.ticker).toBe('MSFT')
})

test('POST returns 400 for invalid frequency', async () => {
  const req = new NextRequest('http://localhost/api/recurring', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'AAPL', amount: 100, frequency: 'hourly' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: 테스트 작성 ([id]/route.ts)**

```typescript
// __tests__/app/api/recurring/recurring-id.test.ts
import { PUT, DELETE } from '@/app/api/recurring/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    recurringInvestment: {
      update: jest.fn().mockResolvedValue(
        { id: 'ri-1', ticker: 'AAPL', amount: 200, frequency: 'weekly', active: false, lastRun: null, createdAt: new Date() }
      ),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('PUT updates recurring investment', async () => {
  const req = new NextRequest('http://localhost/api/recurring/ri-1', {
    method: 'PUT',
    body: JSON.stringify({ amount: 200, active: false }),
  })
  const res = await PUT(req, { params: Promise.resolve({ id: 'ri-1' }) })
  const data = await res.json()
  expect(data.recurring.amount).toBe(200)
})

test('DELETE removes recurring investment', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'ri-1' }) })
  const data = await res.json()
  expect(data.ok).toBe(true)
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npx jest recurring.test recurring-id.test
```

Expected: FAIL

- [ ] **Step 4: recurring/route.ts 구현**

```typescript
// src/app/api/recurring/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

export async function GET() {
  const recurring = await prisma.recurringInvestment.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ recurring })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticker?: string; amount?: number; frequency?: string }

    if (!body.ticker?.trim()) {
      return NextResponse.json({ error: 'Ticker required' }, { status: 400 })
    }
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }
    if (!VALID_FREQUENCIES.includes(body.frequency as typeof VALID_FREQUENCIES[number])) {
      return NextResponse.json({ error: 'frequency must be daily, weekly, or monthly' }, { status: 400 })
    }

    const recurring = await prisma.recurringInvestment.create({
      data: {
        ticker: body.ticker.trim().toUpperCase(),
        amount: body.amount,
        frequency: body.frequency!,
      },
    })

    return NextResponse.json({ recurring }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: recurring/[id]/route.ts 구현**

```typescript
// src/app/api/recurring/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { amount?: number; frequency?: string; active?: boolean }
    const recurring = await prisma.recurringInvestment.update({
      where: { id },
      data: {
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.frequency && { frequency: body.frequency }),
        ...(body.active !== undefined && { active: body.active }),
      },
    })
    return NextResponse.json({ recurring })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.recurringInvestment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx jest recurring.test recurring-id.test
```

Expected: PASS — 5 tests

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/recurring/ __tests__/app/api/recurring/
git commit -m "Feat: add recurring investment CRUD API"
```

---

## Task 5: Recurring 백그라운드 Job + shouldRun 유틸

**Files:**
- Create: `src/lib/recurring.ts`
- Modify: `server.ts`
- Create: `__tests__/lib/recurring.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/recurring.test.ts
import { shouldRun } from '@/lib/recurring'

const DAY = 24 * 60 * 60 * 1000

test('shouldRun returns true when lastRun is null', () => {
  expect(shouldRun('daily', null, new Date())).toBe(true)
})

test('shouldRun daily: true when 24h passed', () => {
  const lastRun = new Date(Date.now() - DAY - 1000)
  expect(shouldRun('daily', lastRun, new Date())).toBe(true)
})

test('shouldRun daily: false when less than 24h', () => {
  const lastRun = new Date(Date.now() - DAY + 60000)
  expect(shouldRun('daily', lastRun, new Date())).toBe(false)
})

test('shouldRun weekly: true when 7 days passed', () => {
  const lastRun = new Date(Date.now() - 7 * DAY - 1000)
  expect(shouldRun('weekly', lastRun, new Date())).toBe(true)
})

test('shouldRun monthly: true when 30 days passed', () => {
  const lastRun = new Date(Date.now() - 30 * DAY - 1000)
  expect(shouldRun('monthly', lastRun, new Date())).toBe(true)
})

test('shouldRun unknown frequency: false', () => {
  expect(shouldRun('hourly', null, new Date())).toBe(false)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest recurring.test
```

Expected: FAIL

- [ ] **Step 3: src/lib/recurring.ts 구현**

```typescript
// src/lib/recurring.ts
const DAY_MS = 24 * 60 * 60 * 1000

export function shouldRun(frequency: string, lastRun: Date | null, now: Date): boolean {
  if (!lastRun) return true
  const elapsed = now.getTime() - lastRun.getTime()
  switch (frequency) {
    case 'daily': return elapsed >= DAY_MS
    case 'weekly': return elapsed >= 7 * DAY_MS
    case 'monthly': return elapsed >= 30 * DAY_MS
    default: return false
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest recurring.test
```

Expected: PASS — 6 tests

- [ ] **Step 5: server.ts에 recurring Job 추가**

`server.ts`를 읽고 `app.prepare().then(...)` 블록의 `wsManager.connect()` 호출 바로 아래에 추가:

```typescript
import { prisma } from './src/lib/db'
import { alpaca } from './src/lib/alpaca/client'
import { shouldRun } from './src/lib/recurring'
```

(파일 상단 import 영역에 추가)

그리고 `server.listen(port, ...)` 호출 바로 위에 아래 함수 호출 추가:

```typescript
  // Recurring investment background job
  setInterval(async () => {
    try {
      const now = new Date()
      const actives = await prisma.recurringInvestment.findMany({ where: { active: true } })
      for (const ri of actives) {
        if (!shouldRun(ri.frequency, ri.lastRun, now)) continue
        try {
          await alpaca.placeOrder({
            symbol: ri.ticker,
            notional: String(ri.amount),
            side: 'buy',
            type: 'market',
            time_in_force: 'day',
          })
          await prisma.recurringInvestment.update({
            where: { id: ri.id },
            data: { lastRun: now },
          })
          console.log(`[Recurring] Invested $${ri.amount} in ${ri.ticker}`)
        } catch (e) {
          console.error(`[Recurring] Failed for ${ri.ticker}:`, e)
        }
      }
    } catch {}
  }, 60 * 1000)
```

- [ ] **Step 6: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/recurring.ts server.ts __tests__/lib/recurring.test.ts
git commit -m "Feat: add recurring investment background job"
```

---

## Task 6: OrderForm 컴포넌트 (매수)

**Files:**
- Create: `src/components/orders/OrderForm.tsx`

- [ ] **Step 1: OrderForm.tsx 작성**

```typescript
// src/components/orders/OrderForm.tsx
'use client'

import { useState } from 'react'

interface Props {
  defaultTicker?: string
  onSuccess?: () => void
}

type OrderType = 'market' | 'limit'
type InputMode = 'qty' | 'notional'

export default function OrderForm({ defaultTicker = '', onSuccess }: Props) {
  const [ticker, setTicker] = useState(defaultTicker)
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [inputMode, setInputMode] = useState<InputMode>('notional')
  const [value, setValue] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [extendedHours, setExtendedHours] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const submit = async () => {
    if (!ticker.trim() || !value) return
    setSubmitting(true)
    setResult(null)

    const body: Record<string, unknown> = {
      ticker: ticker.trim().toUpperCase(),
      side: 'buy',
      type: orderType,
      ...(inputMode === 'qty' ? { qty: parseFloat(value) } : { notional: parseFloat(value) }),
      ...(orderType === 'limit' && limitPrice && { limitPrice: parseFloat(limitPrice) }),
      ...(extendedHours && { extendedHours: true }),
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `주문 완료: ${data.order.status}` })
        setValue('')
        setLimitPrice('')
        onSuccess?.()
      } else {
        setResult({ ok: false, message: data.error ?? '주문 실패' })
      }
    } catch {
      setResult({ ok: false, message: '네트워크 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">매수 주문</h3>

      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="종목 티커 (예: AAPL)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      <div className="flex gap-2">
        {(['market', 'limit'] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
              orderType === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {t === 'market' ? '시장가' : '지정가'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(['notional', 'qty'] as InputMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setInputMode(m)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
              inputMode === m ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {m === 'notional' ? 'USD 금액' : '주 수량'}
          </button>
        ))}
      </div>

      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={inputMode === 'notional' ? 'USD 금액 (예: 100)' : '수량 (예: 0.5)'}
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      {orderType === 'limit' && (
        <input
          type="number"
          value={limitPrice}
          onChange={(e) => setLimitPrice(e.target.value)}
          placeholder="지정가 (USD)"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
      )}

      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={extendedHours}
          onChange={(e) => setExtendedHours(e.target.checked)}
          className="accent-blue-500"
        />
        프리/애프터마켓
      </label>

      {result && (
        <p className={`text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
          {result.message}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting || !ticker.trim() || !value}
        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
      >
        {submitting ? '주문 중...' : '매수'}
      </button>
    </div>
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
git add src/components/orders/OrderForm.tsx
git commit -m "Feat: add OrderForm component for buy orders"
```

---

## Task 7: LotSelector 컴포넌트 (매도)

**Files:**
- Create: `src/components/orders/LotSelector.tsx`

- [ ] **Step 1: LotSelector.tsx 작성**

```typescript
// src/components/orders/LotSelector.tsx
'use client'

import { useEffect, useState } from 'react'

interface LotOption {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  unrealizedPLPct: number
}

interface Props {
  ticker: string
  onSuccess?: () => void
}

export default function LotSelector({ ticker, onSuccess }: Props) {
  const [lots, setLots] = useState<LotOption[]>([])
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [qty, setQty] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((data) => {
        const pos = (data.positions ?? []).find((p: { ticker: string }) => p.ticker === ticker)
        if (pos) setLots(pos.lots.filter((l: LotOption) => l.remainingQty > 0))
      })
      .catch(() => {})
  }, [ticker])

  const selectedLot = lots.find((l) => l.id === selectedLotId)

  const sell = async () => {
    if (!selectedLotId || !qty) return
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          side: 'sell',
          type: orderType,
          qty: parseFloat(qty),
          lotId: selectedLotId,
          ...(orderType === 'limit' && limitPrice && { limitPrice: parseFloat(limitPrice) }),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `매도 주문 완료: ${data.order.status}` })
        setQty('')
        setSelectedLotId('')
        onSuccess?.()
      } else {
        setResult({ ok: false, message: data.error ?? '주문 실패' })
      }
    } catch {
      setResult({ ok: false, message: '네트워크 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  if (lots.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-gray-400 text-sm">보유 Lot이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">{ticker} 매도</h3>

      <div className="space-y-2">
        {lots.map((lot) => {
          const isUp = lot.unrealizedPLPct >= 0
          return (
            <label
              key={lot.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border ${
                selectedLotId === lot.id ? 'border-blue-500 bg-blue-950' : 'border-gray-700 bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="lot"
                value={lot.id}
                checked={selectedLotId === lot.id}
                onChange={() => { setSelectedLotId(lot.id); setQty(String(lot.remainingQty)) }}
                className="accent-blue-500"
              />
              <div className="flex-1">
                <p className="text-xs text-gray-300">{lot.purchaseDate.slice(0, 10)}</p>
                <p className="text-xs text-gray-400">
                  {lot.remainingQty}주 · 취득가 ${lot.purchasePrice.toFixed(2)}
                </p>
              </div>
              <p className={`text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}{lot.unrealizedPLPct.toFixed(2)}%
              </p>
            </label>
          )
        })}
      </div>

      {selectedLot && (
        <>
          <div className="flex gap-2">
            {(['market', 'limit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
                  orderType === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {t === 'market' ? '시장가' : '지정가'}
              </button>
            ))}
          </div>

          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            max={selectedLot.remainingQty}
            placeholder={`수량 (최대 ${selectedLot.remainingQty}주)`}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
          />

          {orderType === 'limit' && (
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="지정가 (USD)"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
            />
          )}
        </>
      )}

      {result && (
        <p className={`text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
          {result.message}
        </p>
      )}

      <button
        onClick={sell}
        disabled={submitting || !selectedLotId || !qty}
        className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
      >
        {submitting ? '주문 중...' : '매도'}
      </button>
    </div>
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
git add src/components/orders/LotSelector.tsx
git commit -m "Feat: add LotSelector component for sell orders with lot selection"
```

---

## Task 8: OrderHistory 컴포넌트

**Files:**
- Create: `src/components/orders/OrderHistory.tsx`

- [ ] **Step 1: OrderHistory.tsx 작성**

```typescript
// src/components/orders/OrderHistory.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'

interface AlpacaOrder {
  id: string
  symbol: string
  side: string
  status: string
  qty: string
  filled_qty: string
  type: string
  filled_avg_price: string | null
  filled_at: string | null
  extended_hours: boolean
}

type Filter = 'all' | 'filled' | 'open'

const STATUS_LABEL: Record<string, string> = {
  filled: '체결',
  partially_filled: '부분체결',
  pending_new: '대기',
  new: '접수',
  canceled: '취소',
  expired: '만료',
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<AlpacaOrder[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const status = filter === 'open' ? 'open' : filter === 'filled' ? 'closed' : 'all'
    fetch(`/api/orders?status=${status}`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const cancel = async (orderId: string) => {
    await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
    load()
  }

  const isOpen = (status: string) =>
    ['pending_new', 'new', 'partially_filled', 'accepted'].includes(status)

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="flex border-b border-gray-800">
        {(['all', 'filled', 'open'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              filter === f ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'
            }`}
          >
            {f === 'all' ? '전체' : f === 'filled' ? '체결' : '미체결'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse h-32 bg-gray-800" />
      ) : orders.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">주문 내역이 없습니다.</p>
      ) : (
        <div>
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white text-sm">{order.symbol}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    order.side === 'buy' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                  }`}>
                    {order.side === 'buy' ? '매수' : '매도'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.type === 'market' ? '시장가' : '지정가'} · {order.qty}주
                  {order.filled_avg_price && ` · $${parseFloat(order.filled_avg_price).toFixed(2)}`}
                </p>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
                {isOpen(order.status) && (
                  <button
                    onClick={() => cancel(order.id)}
                    className="text-[10px] text-red-400 border border-red-900 px-2 py-0.5 rounded"
                  >
                    취소
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
git add src/components/orders/OrderHistory.tsx
git commit -m "Feat: add OrderHistory component with cancel support"
```

---

## Task 9: RecurringForm + RecurringList 컴포넌트

**Files:**
- Create: `src/components/orders/RecurringForm.tsx`
- Create: `src/components/orders/RecurringList.tsx`

- [ ] **Step 1: RecurringForm.tsx 작성**

```typescript
// src/components/orders/RecurringForm.tsx
'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function RecurringForm({ onSuccess }: Props) {
  const [ticker, setTicker] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!ticker.trim() || !amount) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), amount: parseFloat(amount), frequency }),
      })
      if (res.ok) {
        setTicker('')
        setAmount('')
        onSuccess?.()
      } else {
        const d = await res.json()
        setError(d.error ?? '생성 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">정기 투자 추가</h3>

      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="종목 티커 (예: AAPL)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="USD 금액 (예: 100)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFrequency(f)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium ${
              frequency === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {f === 'daily' ? '매일' : f === 'weekly' ? '매주' : '매월'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting || !ticker.trim() || !amount}
        className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl disabled:opacity-40 font-medium"
      >
        {submitting ? '추가 중...' : '정기 투자 추가'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: RecurringList.tsx 작성**

```typescript
// src/components/orders/RecurringList.tsx
'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Recurring {
  id: string
  ticker: string
  amount: number
  frequency: string
  active: boolean
  lastRun: string | null
}

const FREQ_LABEL: Record<string, string> = { daily: '매일', weekly: '매주', monthly: '매월' }

interface Props {
  refreshKey?: number
}

export default function RecurringList({ refreshKey }: Props) {
  const [items, setItems] = useState<Recurring[]>([])

  const load = () =>
    fetch('/api/recurring').then((r) => r.json()).then((d) => setItems(d.recurring ?? []))

  useEffect(() => { load() }, [refreshKey])

  const remove = async (id: string) => {
    await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
    load()
  }

  const toggle = async (id: string, active: boolean) => {
    await fetch(`/api/recurring/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    load()
  }

  if (items.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">정기 투자가 없습니다.</p>
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0">
          <div className="flex-1">
            <p className="text-white text-sm font-medium">{item.ticker}</p>
            <p className="text-xs text-gray-400">
              ${item.amount} · {FREQ_LABEL[item.frequency]}
              {item.lastRun && ` · 최근: ${item.lastRun.slice(0, 10)}`}
            </p>
          </div>
          <button
            onClick={() => toggle(item.id, item.active)}
            className={`text-xs px-2 py-1 rounded-full ${
              item.active ? 'bg-green-950 text-green-400' : 'bg-gray-800 text-gray-500'
            }`}
          >
            {item.active ? '활성' : '비활성'}
          </button>
          <button onClick={() => remove(item.id)} className="text-gray-500 hover:text-red-400 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
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
git add src/components/orders/RecurringForm.tsx src/components/orders/RecurringList.tsx
git commit -m "Feat: add RecurringForm and RecurringList components"
```

---

## Task 10: TradePanel 활성화 + 주문 페이지 조립

**Files:**
- Modify: `src/components/stock/TradePanel.tsx`
- Modify: `src/app/orders/page.tsx`

- [ ] **Step 1: TradePanel.tsx 활성화**

`src/components/stock/TradePanel.tsx` 전체 교체:

```typescript
// src/components/stock/TradePanel.tsx
'use client'

import { useState } from 'react'
import OrderForm from '@/components/orders/OrderForm'
import LotSelector from '@/components/orders/LotSelector'

interface Props {
  ticker: string
}

export default function TradePanel({ ticker }: Props) {
  const [mode, setMode] = useState<'buy' | 'sell' | null>(null)

  if (mode === 'buy') {
    return (
      <div className="space-y-3">
        <button onClick={() => setMode(null)} className="text-xs text-gray-400">← 닫기</button>
        <OrderForm defaultTicker={ticker} onSuccess={() => setMode(null)} />
      </div>
    )
  }

  if (mode === 'sell') {
    return (
      <div className="space-y-3">
        <button onClick={() => setMode(null)} className="text-xs text-gray-400">← 닫기</button>
        <LotSelector ticker={ticker} onSuccess={() => setMode(null)} />
      </div>
    )
  }

  return (
    <div className="flex gap-3 pb-2">
      <button
        onClick={() => setMode('buy')}
        className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm"
      >
        매수
      </button>
      <button
        onClick={() => setMode('sell')}
        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm"
      >
        매도
      </button>
    </div>
  )
}
```

- [ ] **Step 2: orders/page.tsx 전체 교체**

```typescript
// src/app/orders/page.tsx
'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import OrderForm from '@/components/orders/OrderForm'
import OrderHistory from '@/components/orders/OrderHistory'
import RecurringForm from '@/components/orders/RecurringForm'
import RecurringList from '@/components/orders/RecurringList'

type Tab = '주문' | '내역' | '정기투자'

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>('주문')
  const [recurringKey, setRecurringKey] = useState(0)

  return (
    <>
      <TopBar title="주문" />
      <div className="flex border-b border-gray-800 bg-gray-900">
        {(['주문', '내역', '정기투자'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              tab === t ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === '주문' && <OrderForm />}
        {tab === '내역' && <OrderHistory />}
        {tab === '정기투자' && (
          <>
            <RecurringForm onSuccess={() => setRecurringKey((k) => k + 1)} />
            <RecurringList refreshKey={recurringKey} />
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: 전체 테스트 최종 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (50+ tests)

- [ ] **Step 4: 커밋**

```bash
git add src/components/stock/TradePanel.tsx src/app/orders/page.tsx
git commit -m "Feat: activate TradePanel and assemble orders page (buy/sell/history/recurring)"
```

---

## Phase 4 완료 기준

- [ ] `npx jest` → 모든 테스트 PASS
- [ ] Alpaca 키 설정 후 `/orders` 페이지 → 매수 주문 실행 가능
- [ ] 종목 상세 페이지 → 매수/매도 버튼 동작
- [ ] 미체결 주문 취소 기능 동작
- [ ] 정기 투자 설정 후 서버 Cron Job이 자동 매수 실행

## 다음 단계

Phase 5 (자동 전략) 계획을 작성하려면 요청하세요.
