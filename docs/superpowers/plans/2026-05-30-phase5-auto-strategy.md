# Stock Trading App — Phase 5: 자동 전략

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 룰 기반 자동 매도 전략 생성·관리, Lot에 전략 할당, 서버 백그라운드 Job이 실시간 P&L을 모니터링하여 조건 충족 시 자동 매도 실행

**Architecture:** Strategy/StrategyRule 모델은 Phase 1 스키마에 이미 존재. 전략 CRUD API + Lot-Strategy 할당 API를 추가하고, `checkStrategies()` 함수가 Alpaca 포지션의 현재 가격을 사용해 Lot별 P&L을 계산·실행. 서버 setInterval(30초)이 주기적으로 호출.

**Tech Stack:** Prisma (Strategy, StrategyRule, Lot), Alpaca Markets API, Next.js API Routes, Tailwind CSS

---

## 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── strategies/
│   │   │   ├── route.ts                    # GET/POST
│   │   │   └── [id]/
│   │   │       ├── route.ts                # PUT/DELETE
│   │   │       └── rules/
│   │   │           ├── route.ts            # POST (add rule)
│   │   │           └── [ruleId]/route.ts   # DELETE
│   │   └── lots/[id]/strategy/route.ts     # PATCH (assign/unassign)
├── components/
│   ├── settings/
│   │   └── StrategyManager.tsx             # 전략 CRUD UI (룰 포함)
│   └── portfolio/
│       └── LotStrategyBadge.tsx            # Lot에 전략 할당 드롭다운
└── lib/
    └── strategy-monitor.ts                 # checkStrategies() 함수
server.ts                                   # 수정: strategy monitor interval 추가
__tests__/
├── app/api/strategies/
│   ├── strategies.test.ts
│   ├── strategies-id.test.ts
│   └── strategy-rules.test.ts
├── app/api/lots/
│   └── lot-strategy.test.ts
└── lib/
    └── strategy-monitor.test.ts
```

---

## Task 1: Strategy CRUD API

**Files:**
- Create: `src/app/api/strategies/route.ts`
- Create: `src/app/api/strategies/[id]/route.ts`
- Create: `__tests__/app/api/strategies/strategies.test.ts`
- Create: `__tests__/app/api/strategies/strategies-id.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/strategies/strategies.test.ts
import { GET, POST } from '@/app/api/strategies/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    strategy: {
      findMany: jest.fn().mockResolvedValue([
        { id: 's-1', name: '성장주 전략', rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
      ]),
      create: jest.fn().mockResolvedValue({ id: 's-2', name: '배당주 전략', rules: [] }),
    },
  },
}))

test('GET returns strategies with rules', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.strategies).toHaveLength(1)
  expect(data.strategies[0].rules).toHaveLength(1)
})

test('POST creates strategy', async () => {
  const req = new NextRequest('http://localhost/api/strategies', {
    method: 'POST',
    body: JSON.stringify({ name: '배당주 전략' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  expect((await res.json()).strategy.name).toBe('배당주 전략')
})

test('POST returns 400 for missing name', async () => {
  const req = new NextRequest('http://localhost/api/strategies', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
```

```typescript
// __tests__/app/api/strategies/strategies-id.test.ts
import { PUT, DELETE } from '@/app/api/strategies/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    strategy: {
      update: jest.fn().mockResolvedValue({ id: 's-1', name: '수정됨', rules: [] }),
      delete: jest.fn().mockResolvedValue({}),
    },
    lot: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

test('PUT updates strategy name', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'PUT',
    body: JSON.stringify({ name: '수정됨' }),
  })
  const res = await PUT(req, { params: Promise.resolve({ id: 's-1' }) })
  expect((await res.json()).strategy.name).toBe('수정됨')
})

test('DELETE unassigns lots then deletes', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 's-1' }) })
  expect(prisma.lot.updateMany).toHaveBeenCalledWith({
    where: { strategyId: 's-1' },
    data: { strategyId: null },
  })
  expect(prisma.strategy.delete).toHaveBeenCalledWith({ where: { id: 's-1' } })
  expect((await res.json()).ok).toBe(true)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest strategies.test strategies-id.test
```

Expected: FAIL

- [ ] **Step 3: strategies/route.ts 구현**

```typescript
// src/app/api/strategies/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const strategies = await prisma.strategy.findMany({
    include: { rules: { orderBy: { threshold: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ strategies })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const strategy = await prisma.strategy.create({
      data: { name: body.name.trim() },
      include: { rules: true },
    })
    return NextResponse.json({ strategy }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: strategies/[id]/route.ts 구현**

```typescript
// src/app/api/strategies/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { name?: string }
    const strategy = await prisma.strategy.update({
      where: { id },
      data: { ...(body.name && { name: body.name.trim() }) },
      include: { rules: true },
    })
    return NextResponse.json({ strategy })
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
    await prisma.lot.updateMany({ where: { strategyId: id }, data: { strategyId: null } })
    await prisma.strategy.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest strategies.test strategies-id.test
```

Expected: PASS — 5 tests

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/strategies/route.ts src/app/api/strategies/[id]/route.ts __tests__/app/api/strategies/strategies.test.ts __tests__/app/api/strategies/strategies-id.test.ts
git commit -m "Feat: add strategy CRUD API"
```

---

## Task 2: Strategy Rules API + Lot-Strategy 할당 API

**Files:**
- Create: `src/app/api/strategies/[id]/rules/route.ts`
- Create: `src/app/api/strategies/[id]/rules/[ruleId]/route.ts`
- Create: `src/app/api/lots/[id]/strategy/route.ts`
- Create: `__tests__/app/api/strategies/strategy-rules.test.ts`
- Create: `__tests__/app/api/lots/lot-strategy.test.ts`

- [ ] **Step 1: 테스트 작성 (rules)**

```typescript
// __tests__/app/api/strategies/strategy-rules.test.ts
import { POST } from '@/app/api/strategies/[id]/rules/route'
import { DELETE } from '@/app/api/strategies/[id]/rules/[ruleId]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    strategyRule: {
      create: jest.fn().mockResolvedValue({ id: 'r-2', threshold: 50, sellPct: 50, strategyId: 's-1' }),
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('POST adds rule to strategy', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ threshold: 50, sellPct: 50 }),
  })
  const res = await POST(req, { params: Promise.resolve({ id: 's-1' }) })
  expect(res.status).toBe(201)
  expect((await res.json()).rule.threshold).toBe(50)
})

test('POST returns 400 if sellPct > 100', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ threshold: 20, sellPct: 150 }),
  })
  const res = await POST(req, { params: Promise.resolve({ id: 's-1' }) })
  expect(res.status).toBe(400)
})

test('POST allows negative threshold for stop-loss', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.strategyRule.create.mockResolvedValueOnce({ id: 'r-3', threshold: -15, sellPct: 100, strategyId: 's-1' })
  const req = new NextRequest('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ threshold: -15, sellPct: 100 }),
  })
  const res = await POST(req, { params: Promise.resolve({ id: 's-1' }) })
  expect(res.status).toBe(201)
  expect((await res.json()).rule.threshold).toBe(-15)
})

test('DELETE removes rule', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), {
    params: Promise.resolve({ id: 's-1', ruleId: 'r-1' }),
  })
  expect((await res.json()).ok).toBe(true)
})
```

- [ ] **Step 2: 테스트 작성 (lot-strategy)**

```typescript
// __tests__/app/api/lots/lot-strategy.test.ts
import { PATCH } from '@/app/api/lots/[id]/strategy/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      update: jest.fn().mockResolvedValue({ id: 'lot-1', strategyId: 's-1' }),
    },
  },
}))

test('PATCH assigns strategy to lot', async () => {
  const req = new NextRequest('http://localhost', {
    method: 'PATCH',
    body: JSON.stringify({ strategyId: 's-1' }),
  })
  const res = await PATCH(req, { params: Promise.resolve({ id: 'lot-1' }) })
  const data = await res.json()
  expect(data.lot.strategyId).toBe('s-1')
  const { prisma } = jest.requireMock('@/lib/db')
  expect(prisma.lot.update).toHaveBeenCalledWith({
    where: { id: 'lot-1' },
    data: { strategyId: 's-1' },
  })
})

test('PATCH unassigns strategy with null', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.update.mockResolvedValueOnce({ id: 'lot-1', strategyId: null })
  const req = new NextRequest('http://localhost', {
    method: 'PATCH',
    body: JSON.stringify({ strategyId: null }),
  })
  await PATCH(req, { params: Promise.resolve({ id: 'lot-1' }) })
  expect(prisma.lot.update).toHaveBeenCalledWith({
    where: { id: 'lot-1' },
    data: { strategyId: null },
  })
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npx jest strategy-rules.test lot-strategy.test
```

Expected: FAIL

- [ ] **Step 4: strategies/[id]/rules/route.ts 구현**

```typescript
// src/app/api/strategies/[id]/rules/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { threshold?: number; sellPct?: number }

    if (body.threshold === undefined || body.sellPct === undefined) {
      return NextResponse.json({ error: 'threshold and sellPct required' }, { status: 400 })
    }
    if (body.sellPct <= 0 || body.sellPct > 100) {
      return NextResponse.json({ error: 'sellPct must be between 1 and 100' }, { status: 400 })
    }
    // threshold can be negative for stop-loss rules (e.g. -15 = sell when down 15%)

    const rule = await prisma.strategyRule.create({
      data: { strategyId: id, threshold: body.threshold, sellPct: body.sellPct },
    })
    return NextResponse.json({ rule }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: strategies/[id]/rules/[ruleId]/route.ts 구현**

```typescript
// src/app/api/strategies/[id]/rules/[ruleId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const { ruleId } = await params
    await prisma.strategyRule.delete({ where: { id: ruleId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }
}
```

- [ ] **Step 6: lots/[id]/strategy/route.ts 구현**

```typescript
// src/app/api/lots/[id]/strategy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { strategyId: string | null }
    const lot = await prisma.lot.update({
      where: { id },
      data: { strategyId: body.strategyId },
    })
    return NextResponse.json({ lot })
  } catch {
    return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
  }
}
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
npx jest strategy-rules.test lot-strategy.test
```

Expected: PASS — 6 tests

- [ ] **Step 8: 전체 테스트 확인**

```bash
npx jest
```

Expected: 60 tests PASS

- [ ] **Step 9: 커밋**

```bash
git add src/app/api/strategies/[id]/rules/ src/app/api/lots/ __tests__/app/api/strategies/strategy-rules.test.ts __tests__/app/api/lots/lot-strategy.test.ts
git commit -m "Feat: add strategy rules API and lot-strategy assignment API"
```

---

## Task 3: checkStrategies 함수 (strategy-monitor.ts)

**Files:**
- Create: `src/lib/strategy-monitor.ts`
- Create: `__tests__/lib/strategy-monitor.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/strategy-monitor.test.ts
import { checkStrategies } from '@/lib/strategy-monitor'

jest.mock('@/lib/db', () => ({
  prisma: {
    lot: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}))

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: {
    getPositions: jest.fn(),
    placeOrder: jest.fn(),
  },
}))

beforeEach(() => {
  const { prisma } = jest.requireMock('@/lib/db')
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  prisma.lot.findMany.mockReset()
  prisma.lot.update.mockClear()
  alpaca.placeOrder.mockReset()
  alpaca.getPositions.mockReset()
})

test('no-op when no lots have strategies', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await checkStrategies()
  expect(alpaca.getPositions).not.toHaveBeenCalled()
})

test('executes sell when P&L exceeds threshold', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 100, purchasePrice: 150,
    soldQuantity: 0, status: 'active',
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '180', qty: '100',
      avg_entry_price: '150', unrealized_pl: '3000', unrealized_plpc: '0.2' },
  ])
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-1', symbol: 'AAPL', side: 'sell', status: 'filled',
    qty: '30', filled_qty: '30', filled_avg_price: '180', filled_at: '2024-01-15T14:30:00Z',
    type: 'market', extended_hours: false,
  })

  await checkStrategies()

  expect(alpaca.placeOrder).toHaveBeenCalledWith(expect.objectContaining({
    symbol: 'AAPL', side: 'sell', qty: '30',
  }))
  expect(prisma.lot.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 'lot-1' },
    data: expect.objectContaining({ soldQuantity: 30, status: 'active' }),
  }))
})

test('does not sell when P&L below threshold', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 100, purchasePrice: 150,
    soldQuantity: 0, status: 'active',
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '160', qty: '100',
      avg_entry_price: '150', unrealized_pl: '1000', unrealized_plpc: '0.0667' },
  ])
  await checkStrategies()
  expect(alpaca.placeOrder).not.toHaveBeenCalled()
})

test('skips rule if soldQuantity already meets target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 100, purchasePrice: 150,
    soldQuantity: 30, status: 'active', // already sold 30 (30%)
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 30 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '180', qty: '70',
      avg_entry_price: '150', unrealized_pl: '2100', unrealized_plpc: '0.2' },
  ])
  await checkStrategies()
  expect(alpaca.placeOrder).not.toHaveBeenCalled()
})

test('marks lot fully_sold when all shares sold', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.lot.findMany.mockResolvedValue([{
    id: 'lot-1', ticker: 'AAPL', quantity: 10, purchasePrice: 150,
    soldQuantity: 0, status: 'active',
    strategy: { rules: [{ id: 'r-1', threshold: 20, sellPct: 100 }] },
  }])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '180', qty: '10',
      avg_entry_price: '150', unrealized_pl: '300', unrealized_plpc: '0.2' },
  ])
  alpaca.placeOrder.mockResolvedValue({
    id: 'order-1', symbol: 'AAPL', side: 'sell', status: 'filled',
    qty: '10', filled_qty: '10', filled_avg_price: '180', filled_at: '2024-01-15T14:30:00Z',
    type: 'market', extended_hours: false,
  })

  await checkStrategies()

  expect(prisma.lot.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ soldQuantity: 10, status: 'fully_sold' }),
  }))
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest strategy-monitor.test
```

Expected: FAIL

- [ ] **Step 3: strategy-monitor.ts 구현**

```typescript
// src/lib/strategy-monitor.ts
import { prisma } from './db'
import { alpaca } from './alpaca/client'

export async function checkStrategies(): Promise<void> {
  const lots = await prisma.lot.findMany({
    where: { status: 'active', strategyId: { not: null } },
    include: {
      strategy: {
        include: { rules: { orderBy: { threshold: 'asc' } } },
      },
    },
  })

  if (lots.length === 0) return

  const positions = await alpaca.getPositions()
  const priceMap = new Map(
    positions.map((p) => [p.symbol, parseFloat(p.current_price)])
  )

  for (const lot of lots) {
    if (!lot.strategy) continue
    const currentPrice = priceMap.get(lot.ticker)
    if (!currentPrice) continue

    const plPct = ((currentPrice - lot.purchasePrice) / lot.purchasePrice) * 100
    let currentSold = lot.soldQuantity

    for (const rule of lot.strategy.rules) {
      if (plPct < rule.threshold) continue

      const targetCumulative = lot.quantity * (rule.sellPct / 100)
      if (targetCumulative <= currentSold) continue

      const qtyToSell = parseFloat((targetCumulative - currentSold).toFixed(6))
      if (qtyToSell <= 0) continue

      try {
        const order = await alpaca.placeOrder({
          symbol: lot.ticker,
          qty: String(qtyToSell),
          side: 'sell',
          type: 'market',
          time_in_force: 'day',
        })

        if (order.status === 'filled' && order.filled_qty) {
          currentSold += parseFloat(order.filled_qty)
          console.log(`[Strategy] Sold ${order.filled_qty} ${lot.ticker} (+${rule.threshold}% rule)`)
        }
      } catch (e) {
        console.error(`[Strategy] Failed for ${lot.ticker}:`, e)
      }
    }

    if (currentSold !== lot.soldQuantity) {
      await prisma.lot.update({
        where: { id: lot.id },
        data: {
          soldQuantity: currentSold,
          status: currentSold >= lot.quantity ? 'fully_sold' : 'active',
        },
      })
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest strategy-monitor.test
```

Expected: PASS — 5 tests

- [ ] **Step 5: 커밋**

```bash
git add src/lib/strategy-monitor.ts __tests__/lib/strategy-monitor.test.ts
git commit -m "Feat: add checkStrategies monitor function"
```

---

## Task 4: server.ts Strategy Monitor 추가

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: server.ts에 import 추가**

`server.ts`를 읽고 파일 상단 import 영역에 추가:

```typescript
import { checkStrategies } from './src/lib/strategy-monitor'
```

- [ ] **Step 2: strategy monitor interval 추가**

`app.prepare().then(...)` 블록 안, 기존 recurring setInterval 아래에 추가:

```typescript
  setInterval(async () => {
    try {
      await checkStrategies()
    } catch (e) {
      console.error('[Strategy Monitor] Error:', e)
    }
  }, 30 * 1000)
```

- [ ] **Step 3: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add server.ts
git commit -m "Feat: add strategy monitor interval to server (30s)"
```

---

## Task 5: StrategyManager UI + LotStrategyBadge

**Files:**
- Create: `src/components/settings/StrategyManager.tsx`
- Create: `src/components/portfolio/LotStrategyBadge.tsx`

- [ ] **Step 1: StrategyManager.tsx 작성**

```typescript
// src/components/settings/StrategyManager.tsx
'use client'

import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'

interface StrategyRule {
  id: string
  threshold: number
  sellPct: number
}

interface Strategy {
  id: string
  name: string
  rules: StrategyRule[]
}

export default function StrategyManager() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [newName, setNewName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newThreshold, setNewThreshold] = useState('')
  const [newSellPct, setNewSellPct] = useState('')

  const load = () =>
    fetch('/api/strategies').then((r) => r.json()).then((d) => setStrategies(d.strategies ?? []))

  useEffect(() => { load() }, [])

  const createStrategy = async () => {
    if (!newName.trim()) return
    await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setNewName('')
    load()
  }

  const deleteStrategy = async (id: string) => {
    await fetch(`/api/strategies/${id}`, { method: 'DELETE' })
    if (expandedId === id) setExpandedId(null)
    load()
  }

  const addRule = async (strategyId: string) => {
    if (!newThreshold || !newSellPct) return
    const res = await fetch(`/api/strategies/${strategyId}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: parseFloat(newThreshold), sellPct: parseFloat(newSellPct) }),
    })
    if (res.ok) { setNewThreshold(''); setNewSellPct(''); load() }
  }

  const deleteRule = async (strategyId: string, ruleId: string) => {
    await fetch(`/api/strategies/${strategyId}/rules/${ruleId}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4">매매 전략 관리</h3>

      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createStrategy()}
          placeholder="전략 이름 (예: 성장주 전략)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
        <button
          onClick={createStrategy}
          disabled={!newName.trim()}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {strategies.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">전략이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {strategies.map((s) => (
            <div key={s.id} className="border border-gray-700 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-3 py-2.5 cursor-pointer bg-gray-800"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <p className="text-white text-sm font-medium">{s.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{s.rules.length}개 룰</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteStrategy(s.id) }}
                    className="text-gray-500 hover:text-red-400 p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="px-3 py-2 space-y-2 bg-gray-850">
                  {s.rules.length === 0 && (
                    <p className="text-gray-600 text-xs">룰이 없습니다.</p>
                  )}
                  {s.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">
                        {rule.threshold >= 0 ? '+' : ''}{rule.threshold}% 달성 시 → {rule.sellPct}% 매도
                      </span>
                      <button
                        onClick={() => deleteRule(s.id, rule.id)}
                        className="text-gray-600 hover:text-red-400 p-1"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-700">
                    <input
                      type="number"
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(e.target.value)}
                      placeholder="수익률 % (예: 20)"
                      className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-xs outline-none placeholder-gray-600"
                    />
                    <input
                      type="number"
                      value={newSellPct}
                      onChange={(e) => setNewSellPct(e.target.value)}
                      placeholder="매도 % (예: 30)"
                      className="flex-1 bg-gray-800 text-white rounded px-2 py-1 text-xs outline-none placeholder-gray-600"
                    />
                    <button
                      onClick={() => addRule(s.id)}
                      disabled={!newThreshold || !newSellPct}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-700 text-white text-xs rounded disabled:opacity-40"
                    >
                      <Plus size={11} /> 추가
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: LotStrategyBadge.tsx 작성**

```typescript
// src/components/portfolio/LotStrategyBadge.tsx
'use client'

import { useEffect, useState } from 'react'

interface Strategy {
  id: string
  name: string
}

interface Props {
  lotId: string
  currentStrategyId: string | null
}

export default function LotStrategyBadge({ lotId, currentStrategyId }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [selectedId, setSelectedId] = useState<string>(currentStrategyId ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/strategies')
      .then((r) => r.json())
      .then((d) => setStrategies(d.strategies ?? []))
  }, [])

  useEffect(() => {
    setSelectedId(currentStrategyId ?? '')
  }, [currentStrategyId])

  const assign = async (strategyId: string | null) => {
    setSaving(true)
    try {
      await fetch(`/api/lots/${lotId}/strategy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      })
      setSelectedId(strategyId ?? '')
    } finally {
      setSaving(false)
    }
  }

  if (strategies.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[10px] text-gray-500">전략</span>
      <select
        value={selectedId}
        onChange={(e) => assign(e.target.value || null)}
        disabled={saving}
        className="text-[10px] bg-transparent text-blue-400 outline-none cursor-pointer border-0"
      >
        <option value="">없음</option>
        {strategies.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
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
git add src/components/settings/StrategyManager.tsx src/components/portfolio/LotStrategyBadge.tsx
git commit -m "Feat: add StrategyManager UI and LotStrategyBadge components"
```

---

## Task 6: LotRow 업데이트 + Settings 페이지 통합

**Files:**
- Modify: `src/components/portfolio/LotRow.tsx` (strategyId + LotStrategyBadge 추가)
- Modify: `src/components/portfolio/PositionCard.tsx` (strategyId pass-through)
- Modify: `src/app/settings/page.tsx` (StrategyManager 추가)

- [ ] **Step 1: LotRow.tsx에 strategyId + LotStrategyBadge 추가**

`src/components/portfolio/LotRow.tsx`를 읽고, LotDetail 인터페이스에 `strategyId: string | null` 추가 후 컴포넌트 수정:

```typescript
// src/components/portfolio/LotRow.tsx
import LotStrategyBadge from './LotStrategyBadge'

interface LotDetail {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  unrealizedPL: number
  unrealizedPLPct: number
  status: string
  strategyId: string | null
}

export default function LotRow({ lot }: { lot: LotDetail }) {
  const isUp = lot.unrealizedPL >= 0
  const date = lot.purchaseDate.slice(0, 10)

  return (
    <div className="px-4 py-3 flex justify-between items-start border-b border-gray-800 last:border-0 bg-gray-950">
      <div>
        <p className="text-xs text-gray-300">{date}</p>
        <p className="text-xs text-gray-500">
          {lot.remainingQty}주 · 취득가 ${lot.purchasePrice.toFixed(2)}
        </p>
        <LotStrategyBadge lotId={lot.id} currentStrategyId={lot.strategyId} />
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

- [ ] **Step 2: settings/page.tsx에 StrategyManager 추가**

`src/app/settings/page.tsx`를 읽고 StrategyManager import 추가:

```typescript
import StrategyManager from '@/components/settings/StrategyManager'
```

`<CategoryManager />` 바로 아래에 추가:

```typescript
<StrategyManager />
```

- [ ] **Step 3: 전체 테스트 최종 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (65+ tests)

- [ ] **Step 4: 커밋**

```bash
git add src/components/portfolio/LotRow.tsx src/app/settings/page.tsx
git commit -m "Feat: integrate StrategyManager into settings and LotStrategyBadge into LotRow"
```

---

## Phase 5 완료 기준

- [ ] `npx jest` → 모든 테스트 PASS
- [ ] 설정 → 전략 생성 → 룰 추가 (수익률 임계값, 매도%) 동작
- [ ] 포트폴리오 → Lot 행에서 전략 드롭다운으로 할당 가능
- [ ] Alpaca API 키 설정 후 서버 실행 → 30초마다 checkStrategies 실행 (콘솔 확인)

## 다음 단계

Phase 6 (환전 추적 + 세금) 계획을 작성하려면 요청하세요.
