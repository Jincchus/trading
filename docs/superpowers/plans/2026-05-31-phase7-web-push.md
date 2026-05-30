# Stock Trading App — Phase 7: 알림 (Web Push)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web Push API로 목표가 도달·주문 체결·전략 자동 매도 알림을 브라우저에 전송하고, 알림 설정 UI와 내역 페이지 완성

**Architecture:** `web-push` 패키지 + VAPID 키로 서버에서 푸시 발송. 개인 앱(단일 사용자)이므로 구독 정보는 `data/push-subscription.json` 파일로 저장. Alert 모델은 Phase 1 스키마 그대로 사용. 서버 setInterval이 60초마다 목표가 체크, checkStrategies/orders에서 체결 시 즉시 푸시 발송.

**Tech Stack:** web-push, VAPID keys (.env), public/sw.js (service worker), Prisma Alert/AlertHistory, Tailwind CSS

---

## 파일 구조

```
public/
└── sw.js                              # 서비스 워커 (push 이벤트 처리)
src/
├── app/
│   ├── api/
│   │   ├── alerts/
│   │   │   ├── route.ts               # GET/POST /api/alerts
│   │   │   └── [id]/route.ts          # DELETE /api/alerts/[id]
│   │   └── push/subscribe/route.ts    # GET/POST/DELETE 구독 관리
│   └── alerts/
│       └── page.tsx                   # 알림 페이지 (scaffold 교체)
├── components/
│   └── alerts/
│       ├── PushToggle.tsx             # 알림 허용/해제 버튼
│       ├── AlertForm.tsx              # 목표가 알림 생성 폼
│       ├── AlertList.tsx              # 활성 알림 목록
│       └── AlertHistoryList.tsx       # 알림 발송 내역
├── hooks/
│   └── usePushNotification.ts         # 서비스 워커 등록 + 구독 훅
└── lib/
    ├── push-store.ts                   # 구독 정보 파일 저장/읽기
    ├── push.ts                         # sendPushNotification() 헬퍼
    └── alert-monitor.ts               # checkAlerts() 함수
server.ts                              # 수정: alert monitor interval 추가
src/lib/strategy-monitor.ts            # 수정: 전략 실행 시 push 발송
src/app/api/orders/route.ts            # 수정: 체결 시 push 발송
__tests__/
├── lib/
│   ├── push.test.ts
│   └── alert-monitor.test.ts
└── app/api/
    ├── alerts/alerts.test.ts
    └── alerts/alerts-id.test.ts
```

---

## Task 1: VAPID 설정 + Service Worker + Env 확장

**Files:**
- Create: `public/sw.js`
- Modify: `src/lib/env.ts`
- Modify: `jest.setup.ts`
- Modify: `.env.example`

- [ ] **Step 1: web-push 패키지 설치**

```bash
npm install web-push
npm install --save-dev @types/web-push
```

- [ ] **Step 2: VAPID 키 생성**

```bash
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log('PUBLIC:', k.publicKey); console.log('PRIVATE:', k.privateKey)"
```

출력된 PUBLIC/PRIVATE 키를 `.env` 파일에 추가:
```env
VAPID_PUBLIC_KEY=<생성된 공개키>
VAPID_PRIVATE_KEY=<생성된 개인키>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<생성된 공개키 (PUBLIC과 동일)>
VAPID_EMAIL=admin@example.com
```

- [ ] **Step 3: .env.example에 추가**

```env
# Web Push (VAPID) — generate keys: node -e "require('web-push').generateVAPIDKeys()"
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_EMAIL=admin@example.com
```

- [ ] **Step 4: env.ts schema에 추가**

```typescript
VAPID_PUBLIC_KEY: z.string().min(1),
VAPID_PRIVATE_KEY: z.string().min(1),
VAPID_EMAIL: z.string().default('admin@example.com'),
```

- [ ] **Step 5: jest.setup.ts에 테스트용 VAPID 키 추가**

파일 하단에 추가:
```typescript
process.env.VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
process.env.VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSkFU'
process.env.VAPID_EMAIL = 'admin@example.com'
```

- [ ] **Step 6: public/sw.js 작성**

```javascript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? '주식 알림', {
      body: data.body ?? '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow('/alerts')
    })
  )
})
```

- [ ] **Step 7: 전체 테스트 확인**

```bash
npx jest
```

Expected: 81 tests PASS

- [ ] **Step 8: 커밋**

```bash
git add public/sw.js src/lib/env.ts jest.setup.ts .env.example
git commit -m "Feat: add VAPID config, service worker, and env extensions for Web Push"
```

---

## Task 2: push-store.ts + push.ts + Subscription API

**Files:**
- Create: `src/lib/push-store.ts`
- Create: `src/lib/push.ts`
- Create: `src/app/api/push/subscribe/route.ts`
- Create: `__tests__/lib/push.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/lib/push.test.ts
import { sendPushNotification } from '@/lib/push'

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}))

jest.mock('@/lib/push-store', () => ({
  getPushSubscription: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

test('sendPushNotification does nothing when no subscription', async () => {
  const { getPushSubscription } = jest.requireMock('@/lib/push-store')
  getPushSubscription.mockReturnValue(null)

  await sendPushNotification('Test', 'Message')

  const webpush = jest.requireMock('web-push')
  expect(webpush.sendNotification).not.toHaveBeenCalled()
})

test('sendPushNotification sends when subscription exists', async () => {
  const { getPushSubscription } = jest.requireMock('@/lib/push-store')
  getPushSubscription.mockReturnValue({ endpoint: 'https://push.example.com', keys: {} })

  await sendPushNotification('주문 체결', 'AAPL 10주 매수 체결')

  const webpush = jest.requireMock('web-push')
  expect(webpush.sendNotification).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: 'https://push.example.com' }),
    JSON.stringify({ title: '주문 체결', body: 'AAPL 10주 매수 체결' })
  )
})

test('sendPushNotification swallows errors silently', async () => {
  const { getPushSubscription } = jest.requireMock('@/lib/push-store')
  getPushSubscription.mockReturnValue({ endpoint: 'https://push.example.com' })
  const webpush = jest.requireMock('web-push')
  webpush.sendNotification.mockRejectedValueOnce(new Error('Gone'))

  await expect(sendPushNotification('T', 'B')).resolves.toBeUndefined()
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest push.test
```

Expected: FAIL

- [ ] **Step 3: push-store.ts 구현**

```typescript
// src/lib/push-store.ts
import fs from 'fs'
import path from 'path'

const STORE_PATH = path.join(process.cwd(), 'data', 'push-subscription.json')

export function savePushSubscription(sub: object): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  fs.writeFileSync(STORE_PATH, JSON.stringify(sub, null, 2))
}

export function getPushSubscription(): object | null {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

export function deletePushSubscription(): void {
  try { fs.unlinkSync(STORE_PATH) } catch {}
}
```

- [ ] **Step 4: push.ts 구현**

```typescript
// src/lib/push.ts
import webpush from 'web-push'
import { env } from './env'
import { getPushSubscription } from './push-store'

webpush.setVapidDetails(
  `mailto:${env.VAPID_EMAIL}`,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
)

export async function sendPushNotification(title: string, body: string): Promise<void> {
  const sub = getPushSubscription()
  if (!sub) return
  try {
    await webpush.sendNotification(
      sub as webpush.PushSubscription,
      JSON.stringify({ title, body })
    )
  } catch (e) {
    console.error('[Push] Failed:', e)
  }
}
```

- [ ] **Step 5: subscription API 구현**

```typescript
// src/app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { savePushSubscription, getPushSubscription, deletePushSubscription } from '@/lib/push-store'

export async function GET() {
  const sub = getPushSubscription()
  return NextResponse.json({ subscribed: sub !== null })
}

export async function POST(req: NextRequest) {
  const sub = await req.json()
  savePushSubscription(sub)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  deletePushSubscription()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx jest push.test
```

Expected: PASS — 3 tests

- [ ] **Step 7: 커밋**

```bash
git add src/lib/push-store.ts src/lib/push.ts src/app/api/push/subscribe/route.ts __tests__/lib/push.test.ts
git commit -m "Feat: add push notification helper, store, and subscription API"
```

---

## Task 3: Alert CRUD API + alert-monitor.ts

**Files:**
- Create: `src/app/api/alerts/route.ts`
- Create: `src/app/api/alerts/[id]/route.ts`
- Create: `src/lib/alert-monitor.ts`
- Create: `__tests__/app/api/alerts/alerts.test.ts`
- Create: `__tests__/app/api/alerts/alerts-id.test.ts`
- Create: `__tests__/lib/alert-monitor.test.ts`

- [ ] **Step 1: Alert API 테스트 작성**

```typescript
// __tests__/app/api/alerts/alerts.test.ts
import { GET, POST } from '@/app/api/alerts/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    alert: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'a-1', ticker: 'AAPL', targetPrice: 200, direction: 'above', active: true, createdAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue(
        { id: 'a-2', ticker: 'MSFT', targetPrice: 400, direction: 'above', active: true, createdAt: new Date() }
      ),
    },
  },
}))

test('GET returns active alerts', async () => {
  const res = await GET(new NextRequest('http://localhost/api/alerts'))
  const data = await res.json()
  expect(data.alerts).toHaveLength(1)
  expect(data.alerts[0].ticker).toBe('AAPL')
})

test('POST creates target price alert', async () => {
  const req = new NextRequest('http://localhost/api/alerts', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'MSFT', targetPrice: 400, direction: 'above' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  expect((await res.json()).alert.ticker).toBe('MSFT')
})

test('POST returns 400 for invalid direction', async () => {
  const req = new NextRequest('http://localhost/api/alerts', {
    method: 'POST',
    body: JSON.stringify({ ticker: 'AAPL', targetPrice: 200, direction: 'sideways' }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
```

```typescript
// __tests__/app/api/alerts/alerts-id.test.ts
import { DELETE } from '@/app/api/alerts/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    alert: {
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('DELETE removes alert', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'a-1' }) })
  expect((await res.json()).ok).toBe(true)
})
```

- [ ] **Step 2: Alert monitor 테스트 작성**

```typescript
// __tests__/lib/alert-monitor.test.ts
import { checkAlerts } from '@/lib/alert-monitor'

jest.mock('@/lib/db', () => ({
  prisma: {
    alert: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    alertHistory: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}))

jest.mock('@/lib/alpaca/client', () => ({
  alpaca: { getPositions: jest.fn() },
}))

jest.mock('@/lib/push', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

test('no-op when no active alerts', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  await checkAlerts()
  expect(alpaca.getPositions).not.toHaveBeenCalled()
})

test('fires push when price is above target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([
    { id: 'a-1', ticker: 'AAPL', targetPrice: 180, direction: 'above', active: true },
  ])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '185', qty: '10', avg_entry_price: '150', unrealized_pl: '350', unrealized_plpc: '0.233' },
  ])
  await checkAlerts()
  const { sendPushNotification } = jest.requireMock('@/lib/push')
  expect(sendPushNotification).toHaveBeenCalledWith(
    'AAPL 목표가 도달',
    expect.stringContaining('185')
  )
})

test('does not fire when price is below above-target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([
    { id: 'a-1', ticker: 'AAPL', targetPrice: 200, direction: 'above', active: true },
  ])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '175', qty: '10', avg_entry_price: '150', unrealized_pl: '250', unrealized_plpc: '0.166' },
  ])
  await checkAlerts()
  const { sendPushNotification } = jest.requireMock('@/lib/push')
  expect(sendPushNotification).not.toHaveBeenCalled()
})

test('fires push when price is below below-target', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.alert.findMany.mockResolvedValue([
    { id: 'a-1', ticker: 'AAPL', targetPrice: 140, direction: 'below', active: true },
  ])
  const { alpaca } = jest.requireMock('@/lib/alpaca/client')
  alpaca.getPositions.mockResolvedValue([
    { symbol: 'AAPL', current_price: '135', qty: '10', avg_entry_price: '150', unrealized_pl: '-150', unrealized_plpc: '-0.1' },
  ])
  await checkAlerts()
  const { sendPushNotification } = jest.requireMock('@/lib/push')
  expect(sendPushNotification).toHaveBeenCalled()
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

```bash
npx jest alerts.test alerts-id.test alert-monitor.test
```

Expected: FAIL

- [ ] **Step 4: alerts/route.ts 구현**

```typescript
// src/app/api/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const alerts = await prisma.alert.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ alerts })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticker?: string; targetPrice?: number; direction?: string }
    if (!body.ticker?.trim() || !body.targetPrice || !body.direction) {
      return NextResponse.json({ error: 'ticker, targetPrice, direction required' }, { status: 400 })
    }
    if (!['above', 'below'].includes(body.direction)) {
      return NextResponse.json({ error: 'direction must be "above" or "below"' }, { status: 400 })
    }
    const alert = await prisma.alert.create({
      data: {
        ticker: body.ticker.trim().toUpperCase(),
        targetPrice: body.targetPrice,
        direction: body.direction,
      },
    })
    return NextResponse.json({ alert }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: alerts/[id]/route.ts 구현**

```typescript
// src/app/api/alerts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.alert.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 6: alert-monitor.ts 구현**

```typescript
// src/lib/alert-monitor.ts
import { prisma } from './db'
import { alpaca } from './alpaca/client'
import { sendPushNotification } from './push'

export async function checkAlerts(): Promise<void> {
  const alerts = await prisma.alert.findMany({ where: { active: true } })
  if (alerts.length === 0) return

  const positions = await alpaca.getPositions()
  const priceMap = new Map(positions.map((p) => [p.symbol, parseFloat(p.current_price)]))

  for (const alert of alerts) {
    const currentPrice = priceMap.get(alert.ticker)
    if (!currentPrice) continue

    const triggered =
      (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
      (alert.direction === 'below' && currentPrice <= alert.targetPrice)

    if (!triggered) continue

    await sendPushNotification(
      `${alert.ticker} 목표가 도달`,
      `${alert.ticker}가 $${currentPrice.toFixed(2)}에 도달했습니다 (목표: $${alert.targetPrice.toFixed(2)})`
    )

    await prisma.$transaction([
      prisma.alertHistory.create({
        data: { alertId: alert.id, price: currentPrice },
      }),
      prisma.alert.update({
        where: { id: alert.id },
        data: { active: false },
      }),
    ])
  }
}
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
npx jest alerts.test alerts-id.test alert-monitor.test
```

Expected: PASS — 8 tests

- [ ] **Step 8: 전체 테스트 확인**

```bash
npx jest
```

Expected: 90+ tests PASS

- [ ] **Step 9: 커밋**

```bash
git add src/app/api/alerts/ src/lib/alert-monitor.ts __tests__/app/api/alerts/ __tests__/lib/alert-monitor.test.ts
git commit -m "Feat: add alert CRUD API and alert monitor"
```

---

## Task 4: server.ts + checkStrategies + orders 통합

**Files:**
- Modify: `server.ts`
- Modify: `src/lib/strategy-monitor.ts`
- Modify: `src/app/api/orders/route.ts`

- [ ] **Step 1: server.ts에 alert monitor import + interval 추가**

`server.ts`를 읽고 파일 상단 import에 추가:
```typescript
import { checkAlerts } from './src/lib/alert-monitor'
```

기존 strategy monitor setInterval 아래에 추가:
```typescript
  setInterval(async () => {
    try { await checkAlerts() } catch (e) { console.error('[Alert Monitor]', e) }
  }, 60 * 1000)
```

- [ ] **Step 2: strategy-monitor.ts에 push 통합**

`src/lib/strategy-monitor.ts`를 읽고 파일 상단 import에 추가:
```typescript
import { sendPushNotification } from './push'
```

`currentSold += parseFloat(order.filled_qty)` 라인 바로 아래에 추가:
```typescript
            await sendPushNotification(
              `[전략] ${lot.ticker} 자동 매도`,
              `${lot.ticker} ${order.filled_qty}주를 $${order.filled_avg_price ?? '?'}에 자동 매도 (+${rule.threshold}% 룰)`
            )
```

- [ ] **Step 3: orders/route.ts에 체결 push 추가**

`src/app/api/orders/route.ts`를 읽고 파일 상단 import에 추가:
```typescript
import { sendPushNotification } from '@/lib/push'
```

`return NextResponse.json({ order }, { status: 201 })` 바로 위에 추가:
```typescript
    if (order.status === 'filled') {
      const side = body.side === 'buy' ? '매수' : '매도'
      await sendPushNotification(
        `${order.symbol} 주문 체결`,
        `${order.symbol} ${order.filled_qty}주 ${side} 체결 @ $${order.filled_avg_price ?? '?'}`
      ).catch(() => {})
    }
```

- [ ] **Step 4: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (orders 테스트: push mock 추가 필요)

orders.test.ts에 mock 추가 (`jest.mock('@/lib/exchange-rate', ...)` 아래):
```typescript
jest.mock('@/lib/push', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
}))
```

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add server.ts src/lib/strategy-monitor.ts src/app/api/orders/route.ts __tests__/app/api/orders/orders.test.ts
git commit -m "Feat: integrate push notifications into server intervals, strategy monitor, and orders"
```

---

## Task 5: AlertsPage UI + 컴포넌트

**Files:**
- Create: `src/hooks/usePushNotification.ts`
- Create: `src/components/alerts/PushToggle.tsx`
- Create: `src/components/alerts/AlertForm.tsx`
- Create: `src/components/alerts/AlertList.tsx`
- Create: `src/components/alerts/AlertHistoryList.tsx`
- Modify: `src/app/alerts/page.tsx`

- [ ] **Step 1: usePushNotification.ts 작성**

```typescript
// src/hooks/usePushNotification.ts
'use client'

import { useEffect, useState } from 'react'

export function usePushNotification() {
  const [subscribed, setSubscribed] = useState(false)
  const [supported, setSupported] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(isSupported)
    if (isSupported) {
      fetch('/api/push/subscribe').then((r) => r.json()).then((d) => setSubscribed(d.subscribed)).catch(() => {})
    }
  }, [])

  const subscribe = async () => {
    setLoading(true)
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setSubscribed(true)
    } catch (e) {
      console.error('[Push] Subscribe failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      await fetch('/api/push/subscribe', { method: 'DELETE' })
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  return { subscribed, supported, loading, subscribe, unsubscribe }
}
```

- [ ] **Step 2: PushToggle.tsx 작성**

```typescript
// src/components/alerts/PushToggle.tsx
'use client'

import { usePushNotification } from '@/hooks/usePushNotification'
import { Bell, BellOff } from 'lucide-react'

export default function PushToggle() {
  const { subscribed, supported, loading, subscribe, unsubscribe } = usePushNotification()

  if (!supported) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-gray-500 text-sm">이 브라우저는 푸시 알림을 지원하지 않습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-white font-medium text-sm">알림 수신</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {subscribed ? '알림이 활성화되어 있습니다' : '목표가·체결·전략 알림을 받으세요'}
        </p>
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${
          subscribed
            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
      >
        {subscribed ? <BellOff size={15} /> : <Bell size={15} />}
        {loading ? '...' : subscribed ? '해제' : '허용'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: AlertForm.tsx 작성**

```typescript
// src/components/alerts/AlertForm.tsx
'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function AlertForm({ onSuccess }: Props) {
  const [ticker, setTicker] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!ticker.trim() || !targetPrice) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), targetPrice: parseFloat(targetPrice), direction }),
      })
      if (res.ok) {
        setTicker('')
        setTargetPrice('')
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
      <h3 className="text-white font-semibold">목표가 알림 설정</h3>

      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="종목 티커 (예: AAPL)"
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
      />

      <div className="flex gap-2">
        <input
          type="number"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder="목표 가격 (USD)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
        <div className="flex rounded-lg overflow-hidden">
          {(['above', 'below'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`px-3 py-2 text-xs font-medium ${
                direction === d ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {d === 'above' ? '이상' : '이하'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting || !ticker.trim() || !targetPrice}
        className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl disabled:opacity-40 font-medium"
      >
        {submitting ? '추가 중...' : '알림 추가'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: AlertList.tsx 작성**

```typescript
// src/components/alerts/AlertList.tsx
'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface Alert {
  id: string
  ticker: string
  targetPrice: number
  direction: string
  active: boolean
  createdAt: string
}

interface Props {
  refreshKey?: number
}

export default function AlertList({ refreshKey }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([])

  const load = () =>
    fetch('/api/alerts').then((r) => r.json()).then((d) => setAlerts(d.alerts ?? []))

  useEffect(() => { load() }, [refreshKey])

  const remove = async (id: string) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    load()
  }

  if (alerts.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">설정된 알림이 없습니다.</p>
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {alerts.map((a) => (
        <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
          <div>
            <p className="text-white text-sm font-medium">{a.ticker}</p>
            <p className="text-xs text-gray-400">
              ${a.targetPrice.toFixed(2)} {a.direction === 'above' ? '이상' : '이하'} 시 알림
            </p>
          </div>
          <button onClick={() => remove(a.id)} className="text-gray-500 hover:text-red-400 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: AlertHistoryList.tsx 작성**

```typescript
// src/components/alerts/AlertHistoryList.tsx
'use client'

import { useEffect, useState } from 'react'

interface AlertHistory {
  id: string
  triggeredAt: string
  price: number
  alert: {
    ticker: string
    targetPrice: number
    direction: string
  }
}

export default function AlertHistoryList() {
  const [history, setHistory] = useState<AlertHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/alerts?history=true')
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.history ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-16 bg-gray-800 rounded-xl" />
  if (history.length === 0) return <p className="text-gray-500 text-sm text-center py-4">알림 내역이 없습니다.</p>

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {history.map((h) => (
        <div key={h.id} className="px-4 py-3 border-b border-gray-800 last:border-0">
          <div className="flex justify-between">
            <p className="text-white text-sm font-medium">{h.alert.ticker}</p>
            <p className="text-xs text-gray-400">{h.triggeredAt.slice(0, 10)}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            ${h.price.toFixed(2)} 도달 (목표: ${h.alert.targetPrice.toFixed(2)} {h.alert.direction === 'above' ? '이상' : '이하'})
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: alerts API에 history 조회 추가**

`src/app/api/alerts/route.ts`의 GET 함수를 수정:
```typescript
export async function GET(req: NextRequest) {
  const showHistory = req.nextUrl.searchParams.get('history') === 'true'

  if (showHistory) {
    const history = await prisma.alertHistory.findMany({
      include: { alert: true },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ history })
  }

  const alerts = await prisma.alert.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ alerts })
}
```

- [ ] **Step 7: alerts/page.tsx 전체 교체**

```typescript
// src/app/alerts/page.tsx
'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import PushToggle from '@/components/alerts/PushToggle'
import AlertForm from '@/components/alerts/AlertForm'
import AlertList from '@/components/alerts/AlertList'
import AlertHistoryList from '@/components/alerts/AlertHistoryList'

type Tab = '설정' | '내역'

export default function AlertsPage() {
  const [tab, setTab] = useState<Tab>('설정')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <TopBar title="알림" />
      <div className="flex border-b border-gray-800 bg-gray-900">
        {(['설정', '내역'] as Tab[]).map((t) => (
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
        {tab === '설정' && (
          <>
            <PushToggle />
            <AlertForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            <AlertList refreshKey={refreshKey} />
          </>
        )}
        {tab === '내역' && <AlertHistoryList />}
      </div>
    </>
  )
}
```

- [ ] **Step 8: 전체 테스트 최종 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (90+ tests)

- [ ] **Step 9: 커밋**

```bash
git add src/hooks/usePushNotification.ts src/components/alerts/ src/app/alerts/page.tsx src/app/api/alerts/route.ts
git commit -m "Feat: assemble alerts page (push toggle, target price alerts, history)"
```

---

## Phase 7 완료 기준

- [ ] `npx jest` → 모든 테스트 PASS
- [ ] 브라우저에서 알림 허용 → 서비스 워커 등록 확인
- [ ] 목표가 알림 설정 → 60초 내 서버 체크 동작
- [ ] 주문 체결 시 즉시 푸시 알림
- [ ] 전략 자동 매도 시 즉시 푸시 알림

## 다음 단계

Phase 8 (종목 탐색 + 대시보드) 계획을 작성하려면 요청하세요.
