# Bot Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 trading-stock-trading Next.js 앱에 `/bot` 페이지를 추가해 트레이딩봇 전략별 성과를 비교·조회하고 start/stop 제어한다. 봇 서버(FastAPI)에는 보유 포지션 조회 엔드포인트를 추가한다.

**Architecture:** 봇 서버(`/home/server/tradingbot`, FastAPI)에 `GET /strategies/{id}/positions` 추가 → 프론트(`/home/server/trading`, Next.js)에서 `NEXT_PUBLIC_BOT_API_URL`로 직접 fetch. 테스트 가능한 순수 로직(포맷·데이터 변환)은 `src/lib/bot-*.ts`에 모아 jest로 TDD하고, React 컴포넌트는 그 lib를 소비하며 `next build`로 검증(이 레포는 jsdom 없이 node 환경 jest라 컴포넌트 단위 테스트는 안 함 — 기존 관례).

**Tech Stack:** FastAPI/pytest (봇 서버), Next.js 16 / React 19 / TypeScript / Tailwind v4 / lightweight-charts v5 / lucide-react / jest+ts-jest (프론트)

---

## 두 레포 주의

- **봇 서버 레포:** `/home/server/tradingbot` — Task 1 (Python). venv: `/home/server/tradingbot/.venv`
- **프론트 레포:** `/home/server/trading` — Task 2~10 (TypeScript)

각 Task의 `git` 명령은 해당 레포 디렉토리에서 실행한다.

---

## 파일 구조

### 봇 서버 (`/home/server/tradingbot`)
```
api/schemas.py     # PositionResponse 추가 (수정)
api/main.py        # GET /strategies/{id}/positions 추가 (수정)
tests/test_api.py  # positions 테스트 추가 (수정)
```

### 프론트 (`/home/server/trading`)
```
src/lib/bot-format.ts          # 순수 포맷/변환 헬퍼 (신규)
src/lib/bot-api.ts             # 봇 API fetch 래퍼 + 타입 (신규)
__tests__/lib/bot-format.test.ts   # bot-format 테스트 (신규)
__tests__/lib/bot-api.test.ts      # bot-api fetch 래퍼 테스트 (신규)
src/components/layout/TopBar.tsx    # action 슬롯 추가 (수정)
src/components/layout/BottomNav.tsx # 봇 항목 추가 (수정)
src/components/bot/ComparisonChart.tsx   # 누적 수익률 오버레이 차트 (신규)
src/components/bot/StrategyAccordion.tsx # 전략 정보 + start/stop (신규)
src/components/bot/AssetCard.tsx         # 자산 요약 + 라인차트 (신규)
src/components/bot/OverviewTab.tsx       # 서브탭: 개요 (신규)
src/components/bot/PositionsTab.tsx      # 서브탭: 포지션 (신규)
src/components/bot/TradesTab.tsx         # 서브탭: 체결 (신규)
src/app/bot/page.tsx                     # /bot 페이지 (신규)
```

---

## Task 1: 봇 서버 — GET /strategies/{id}/positions

**레포:** `/home/server/tradingbot`

**Files:**
- Modify: `api/schemas.py`
- Modify: `api/main.py`
- Test: `tests/test_api.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/test_api.py` 끝에 추가

```python
def test_get_positions_returns_list(client, seeded_db):
    mock_pos = MagicMock()
    mock_pos.symbol = "AAPL"
    mock_pos.qty = "10"
    mock_pos.avg_entry_price = "182.50"
    mock_pos.current_price = "190.00"
    mock_pos.unrealized_pl = "75.00"
    mock_pos.unrealized_plpc = "0.0411"

    with patch("api.main.TradingClient") as mock_cls:
        mock_cls.return_value.get_all_positions.return_value = [mock_pos]
        resp = client.get("/strategies/1/positions")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "AAPL"
    # Pydantic v2는 Decimal을 입력 정밀도 그대로 문자열 직렬화 ("10"→"10", "75.00"→"75.00")
    assert data[0]["qty"] == "10"
    assert data[0]["unrealized_pl"] == "75.00"

def test_get_positions_strategy_not_found(client, seeded_db):
    resp = client.get("/strategies/999/positions")
    assert resp.status_code == 404
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run: `cd /home/server/tradingbot && .venv/bin/python -m pytest tests/test_api.py::test_get_positions_returns_list -v`
Expected: FAIL (404 또는 라우트 없음 → `assert 404 == 200` 실패)

- [ ] **Step 3: `api/schemas.py`에 PositionResponse 추가** — 파일 끝에 추가

```python
class PositionResponse(BaseModel):
    symbol: str
    qty: Decimal
    avg_entry_price: Decimal
    current_price: Optional[Decimal]
    unrealized_pl: Decimal
    unrealized_plpc: Decimal

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: `api/main.py` 수정** — import에 TradingClient + PositionResponse 추가

`from alpaca.trading.client import TradingClient` 를 import 블록에 추가하고,
`from api.schemas import (...)` 에 `PositionResponse` 를 추가한다.

- [ ] **Step 5: `api/main.py`에 엔드포인트 추가** — `get_trades` 핸들러 다음에 추가

```python
@app.get("/strategies/{id}/positions", response_model=List[PositionResponse])
def get_positions(id: int, engine: Engine = Depends(get_engine)):
    with Session(engine) as session:
        strategy = session.get(Strategy, id)
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")
        key, secret = strategy.alpaca_key, strategy.alpaca_secret
    try:
        client = TradingClient(key, secret, paper=True)
        positions = client.get_all_positions()
    except Exception:
        raise HTTPException(status_code=502, detail="Alpaca positions fetch failed")
    return [
        PositionResponse(
            symbol=p.symbol,
            qty=p.qty,
            avg_entry_price=p.avg_entry_price,
            current_price=getattr(p, "current_price", None),
            unrealized_pl=p.unrealized_pl,
            unrealized_plpc=p.unrealized_plpc,
        )
        for p in positions
    ]
```

- [ ] **Step 6: 테스트 실행 (통과 확인)**

Run: `cd /home/server/tradingbot && .venv/bin/python -m pytest tests/test_api.py -v`
Expected: 전부 PASS (기존 7 + 신규 2 = 9 passed)

- [ ] **Step 7: Commit**

```bash
cd /home/server/tradingbot
git add api/schemas.py api/main.py tests/test_api.py
git commit -m "Feat: add GET /strategies/{id}/positions endpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 8: 컨테이너 재빌드 (실서버 반영)**

Run: `cd /home/server/tradingbot && docker compose up --build -d`
그 후 확인: `curl -s http://localhost:8000/strategies/1/positions` → JSON 배열(`[]` 또는 포지션) 반환

---

## Task 2: 프론트 — bot-format.ts (순수 헬퍼) + 테스트

**레포:** `/home/server/trading`

**Files:**
- Create: `src/lib/bot-format.ts`
- Test: `__tests__/lib/bot-format.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `__tests__/lib/bot-format.test.ts`

```typescript
import {
  formatUsd, formatPct, tabLabel, pnlColorClass,
  buildComparisonSeries, filterByPeriod,
} from '@/lib/bot-format'

test('formatUsd: 통화 포맷', () => {
  expect(formatUsd(10240)).toBe('$10,240.00')
  expect(formatUsd('9920.5')).toBe('$9,920.50')
})

test('formatPct: 분수 입력 → 부호 % 2자리', () => {
  expect(formatPct(0.024)).toBe('+2.40%')
  expect(formatPct(-0.015)).toBe('-1.50%')
  expect(formatPct(0)).toBe('+0.00%')
})

test('tabLabel: 이름 마지막 단어, 없으면 #id', () => {
  expect(tabLabel('MA 크로스오버 v1', 1)).toBe('v1')
  expect(tabLabel('', 3)).toBe('#3')
  expect(tabLabel('   ', 4)).toBe('#4')
})

test('pnlColorClass: 부호별 색상', () => {
  expect(pnlColorClass(5)).toBe('text-emerald-400')
  expect(pnlColorClass(-5)).toBe('text-red-400')
  expect(pnlColorClass(0)).toBe('text-gray-400')
})

test('buildComparisonSeries: budget 대비 % 시계열', () => {
  const history = [
    { timestamp: '2026-05-31T00:00:00', equity: '10000' },
    { timestamp: '2026-05-31T00:05:00', equity: '10240' },
  ]
  const series = buildComparisonSeries(history, 10000)
  expect(series[0].value).toBeCloseTo(0, 5)
  expect(series[1].value).toBeCloseTo(2.4, 5)
  expect(series[1].time).toBe(Math.floor(new Date('2026-05-31T00:05:00').getTime() / 1000))
})

test('filterByPeriod: 기간 필터', () => {
  const now = 1_000_000
  const series = [
    { time: now - 40 * 86400, value: 1 },
    { time: now - 10 * 86400, value: 2 },
    { time: now - 1 * 86400, value: 3 },
  ]
  expect(filterByPeriod(series, '7d', now).length).toBe(1)
  expect(filterByPeriod(series, '30d', now).length).toBe(2)
  expect(filterByPeriod(series, 'all', now).length).toBe(3)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run: `cd /home/server/trading && npx jest bot-format -i`
Expected: FAIL (Cannot find module '@/lib/bot-format')

- [ ] **Step 3: `src/lib/bot-format.ts` 작성**

```typescript
export type SeriesPoint = { time: number; value: number }
export type Period = '7d' | '30d' | 'all'

export function formatUsd(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// 분수(0.024) → "+2.40%"
export function formatPct(fraction: number): string {
  const pct = fraction * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function tabLabel(name: string, id: number): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.length > 0 ? words[words.length - 1] : `#${id}`
}

export function pnlColorClass(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-gray-400'
}

// KST "MM/DD HH:mm"
export function formatKstDateTime(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

// equity 시계열 → budget 대비 퍼센트포인트 (value 단위: %, 예 2.4)
export function buildComparisonSeries(
  history: { timestamp: string; equity: string }[],
  budget: number,
): SeriesPoint[] {
  if (!budget) return []
  return history.map((h) => ({
    time: Math.floor(new Date(h.timestamp).getTime() / 1000),
    value: (parseFloat(h.equity) / budget - 1) * 100,
  }))
}

export function filterByPeriod(series: SeriesPoint[], period: Period, nowSec: number): SeriesPoint[] {
  if (period === 'all') return series
  const days = period === '7d' ? 7 : 30
  const cutoff = nowSec - days * 86400
  return series.filter((p) => p.time >= cutoff)
}
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

Run: `cd /home/server/trading && npx jest bot-format -i`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/server/trading
git add src/lib/bot-format.ts __tests__/lib/bot-format.test.ts
git commit -m "feat(bot): add bot-format pure helpers with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 프론트 — bot-api.ts (fetch 래퍼 + 타입)

**레포:** `/home/server/trading`

**Files:**
- Create: `src/lib/bot-api.ts`
- Test: `__tests__/lib/bot-api.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `__tests__/lib/bot-api.test.ts`

```typescript
import { getStrategies, startStrategy, BOT_API } from '@/lib/bot-api'

afterEach(() => { jest.restoreAllMocks() })

test('getStrategies: GET /strategies 호출 + JSON 반환', async () => {
  const fake = [{ id: 1, name: 'v1', strategy_type: 'ma_crossover', budget: '10000',
                  status: 'running', run_interval: '1m', created_at: '2026-05-31T00:00:00' }]
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(fake), { status: 200 }),
  )
  const result = await getStrategies()
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/strategies`, expect.anything())
  expect(result[0].name).toBe('v1')
})

test('startStrategy: POST /strategies/{id}/start', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ message: 'started' }), { status: 200 }),
  )
  await startStrategy(2)
  expect(spy).toHaveBeenCalledWith(`${BOT_API}/strategies/2/start`,
    expect.objectContaining({ method: 'POST' }))
})

test('getStrategies: 오류 응답 시 throw', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('err', { status: 500 }))
  await expect(getStrategies()).rejects.toThrow()
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run: `cd /home/server/trading && npx jest bot-api -i`
Expected: FAIL (Cannot find module '@/lib/bot-api')

- [ ] **Step 3: `src/lib/bot-api.ts` 작성**

```typescript
export const BOT_API = process.env.NEXT_PUBLIC_BOT_API_URL ?? 'http://localhost:8000'

export interface Strategy {
  id: number
  name: string
  strategy_type: string
  budget: string
  status: 'running' | 'stopped' | 'failed'
  run_interval: string
  created_at: string
}
export interface PortfolioPoint {
  id: number; timestamp: string; equity: string; cash: string; unrealized_pnl: string
}
export interface Performance {
  id: number; date: string; total_value: string; daily_return: string
  win_rate: string | null; sharpe_ratio: string | null; drawdown: string | null
}
export interface Trade {
  id: number; symbol: string; side: 'buy' | 'sell'; qty: string; price: string
  alpaca_order_id: string; filled_at: string
}
export interface Position {
  symbol: string; qty: string; avg_entry_price: string; current_price: string | null
  unrealized_pl: string; unrealized_plpc: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BOT_API}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}
async function post(path: string): Promise<void> {
  const res = await fetch(`${BOT_API}${path}`, { method: 'POST' })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
}

export const getStrategies = () => get<Strategy[]>('/strategies')
export const getPortfolio = (id: number) => get<PortfolioPoint[]>(`/strategies/${id}/portfolio`)
export const getPerformance = (id: number) => get<Performance[]>(`/strategies/${id}/performance`)
export const getTrades = (id: number) => get<Trade[]>(`/strategies/${id}/trades`)
export const getPositions = (id: number) => get<Position[]>(`/strategies/${id}/positions`)
export const startStrategy = (id: number) => post(`/strategies/${id}/start`)
export const stopStrategy = (id: number) => post(`/strategies/${id}/stop`)
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

Run: `cd /home/server/trading && npx jest bot-api -i`
Expected: PASS (3 tests). (`get`은 `cache:'no-store'` 옵션을 두 번째 인자로 넘기므로 `expect.anything()` 매칭됨)

- [ ] **Step 5: Commit**

```bash
cd /home/server/trading
git add src/lib/bot-api.ts __tests__/lib/bot-api.test.ts
git commit -m "feat(bot): add bot-api fetch wrappers with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: TopBar action 슬롯 + BottomNav 봇 항목

**레포:** `/home/server/trading`

**Files:**
- Modify: `src/components/layout/TopBar.tsx`
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: `TopBar.tsx`를 action 슬롯 지원으로 교체** (기존 사용처는 `title`만 넘기므로 하위호환)

```tsx
import type { ReactNode } from 'react'

export default function TopBar({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
      <div className="flex items-center justify-between h-12 max-w-md mx-auto px-4">
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {action}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: `BottomNav.tsx`에 봇 항목 추가** — import와 NAV 배열 수정

import 줄을 다음으로 교체:
```tsx
import { Home, BarChart2, Bot, Search, ShoppingCart, Wallet, Bell, Settings } from 'lucide-react'
```
NAV 배열에서 portfolio 다음에 봇 추가:
```tsx
const NAV = [
  { href: '/', label: '홈', icon: Home },
  { href: '/portfolio', label: '포트폴리오', icon: BarChart2 },
  { href: '/bot', label: '봇', icon: Bot },
  { href: '/explore', label: '탐색', icon: Search },
  { href: '/orders', label: '주문', icon: ShoppingCart },
  { href: '/assets', label: '자산', icon: Wallet },
  { href: '/alerts', label: '알림', icon: Bell },
  { href: '/settings', label: '설정', icon: Settings },
]
```

- [ ] **Step 3: 타입체크/빌드로 검증**

Run: `cd /home/server/trading && npx tsc --noEmit`
Expected: 에러 없음 (`Bot` 아이콘이 lucide-react에 없으면 여기서 실패 → 있으면 `Cpu` 등으로 대체)

- [ ] **Step 4: Commit**

```bash
cd /home/server/trading
git add src/components/layout/TopBar.tsx src/components/layout/BottomNav.tsx
git commit -m "feat(bot): TopBar action slot + BottomNav 봇 entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: ComparisonChart 컴포넌트

**레포:** `/home/server/trading`

**Files:**
- Create: `src/components/bot/ComparisonChart.tsx`

전략별 색상은 인덱스 순서 고정: `['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']`

- [ ] **Step 1: `src/components/bot/ComparisonChart.tsx` 작성**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, UTCTimestamp, IChartApi } from 'lightweight-charts'
import { SeriesPoint, Period, filterByPeriod } from '@/lib/bot-format'

export const STRATEGY_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']

export interface ComparisonLine {
  id: number
  label: string
  color: string
  series: SeriesPoint[]   // buildComparisonSeries 결과 (value 단위 %)
  lastPct: number         // 마지막 값 (범례용, % 단위)
}

const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: '7일' }, { id: '30d', label: '30일' }, { id: 'all', label: '전체' },
]

export default function ComparisonChart({
  lines, period, onPeriodChange,
}: { lines: ComparisonLine[]; period: Period; onPeriodChange: (p: Period) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<Map<number, ReturnType<IChartApi['addSeries']>>>(new Map())

  // 차트 1회 생성
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: containerRef.current.clientWidth,
      height: 160,
      timeScale: { timeVisible: false },
      rightPriceScale: { borderColor: '#1f2937' },
    })
    chartRef.current = chart
    const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth })
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.remove(); seriesRef.current.clear() }
  }, [])

  // lines/period 변경 시 시리즈 갱신 (재생성 없이 setData)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const nowSec = Math.floor(Date.now() / 1000)
    const seen = new Set<number>()
    for (const line of lines) {
      seen.add(line.id)
      let s = seriesRef.current.get(line.id)
      if (!s) {
        s = chart.addSeries(LineSeries, { color: line.color, lineWidth: 2, priceLineVisible: false })
        seriesRef.current.set(line.id, s)
      } else {
        s.applyOptions({ color: line.color })
      }
      s.setData(filterByPeriod(line.series, period, nowSec) as { time: UTCTimestamp; value: number }[])
    }
    // 사라진 전략 시리즈 제거
    for (const [id, s] of seriesRef.current) {
      if (!seen.has(id)) { chart.removeSeries(s); seriesRef.current.delete(id) }
    }
    chart.timeScale().fitContent()
  }, [lines, period])

  return (
    <div className="bg-gray-900 rounded-xl p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-400 font-medium">누적 수익률 비교</span>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => onPeriodChange(p.id)}
              className={`text-[10px] px-2 py-0.5 rounded ${
                period === p.id ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {lines.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">표시할 데이터가 없습니다</div>
      ) : (
        <div ref={containerRef} className="w-full" />
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {lines.map((l) => (
          <span key={l.id} className="text-[10px]" style={{ color: l.color }}>
            ● {l.label} {l.lastPct >= 0 ? '+' : ''}{l.lastPct.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입체크**

Run: `cd /home/server/trading && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
cd /home/server/trading
git add src/components/bot/ComparisonChart.tsx
git commit -m "feat(bot): comparison chart (overlay line series)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: StrategyAccordion 컴포넌트 (전략 정보 + start/stop)

**레포:** `/home/server/trading`

**Files:**
- Create: `src/components/bot/StrategyAccordion.tsx`

- [ ] **Step 1: `src/components/bot/StrategyAccordion.tsx` 작성**

```tsx
'use client'

import { useState } from 'react'
import { ChevronRight, Play, Square } from 'lucide-react'
import { Strategy, startStrategy, stopStrategy } from '@/lib/bot-api'
import { formatUsd } from '@/lib/bot-format'

// strategy_type → 설명/종목 하드코딩 맵
const STRATEGY_META: Record<string, { desc: string; symbols: string[] }> = {
  ma_crossover: {
    desc: '단기(10)·장기(30) 이동평균 크로스오버 전략. 골든크로스 매수, 데드크로스 청산.',
    symbols: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'],
  },
}

const STATUS_BADGE: Record<string, string> = {
  running: 'bg-emerald-900 text-emerald-400',
  stopped: 'bg-gray-700 text-gray-300',
  failed: 'bg-red-900 text-red-400',
}

export default function StrategyAccordion({
  strategy, color, onChanged,
}: { strategy: Strategy; color: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = STRATEGY_META[strategy.strategy_type] ?? { desc: strategy.strategy_type, symbols: [] }
  const isRunning = strategy.status === 'running'

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const verb = isRunning ? '정지' : '시작'
    if (!window.confirm(`${strategy.name} 전략을 ${verb}할까요?`)) return
    setBusy(true); setError(null)
    try {
      await (isRunning ? stopStrategy(strategy.id) : startStrategy(strategy.id))
      onChanged()
    } catch {
      setError(`전략 ${verb} 실패`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <span className="text-white text-sm font-semibold">{strategy.name}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[strategy.status] ?? STATUS_BADGE.stopped}`}>
            ● {strategy.status}
          </span>
          <button onClick={toggle} disabled={busy}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full disabled:opacity-50 ${
              isRunning ? 'bg-red-950 text-red-400' : 'bg-emerald-950 text-emerald-400'}`}>
            {isRunning ? <Square size={11} /> : <Play size={11} />}
            {busy ? '...' : isRunning ? '정지' : '시작'}
          </button>
          <ChevronRight size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </div>
      {error && <p className="px-3 pb-2 text-red-400 text-xs">{error}</p>}
      {open && (
        <div className="px-3 pb-3 border-t border-gray-800">
          <p className="text-gray-400 text-[11px] leading-relaxed my-2">{meta.desc}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">{strategy.run_interval}</span>
            <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">예산 {formatUsd(strategy.budget)}</span>
            {meta.symbols.length > 0 && (
              <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">{meta.symbols.join(' · ')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 타입체크**

Run: `cd /home/server/trading && npx tsc --noEmit`
Expected: 에러 없음 (`Play`/`Square`/`ChevronRight` 미존재 시 대체 아이콘으로)

- [ ] **Step 3: Commit**

```bash
cd /home/server/trading
git add src/components/bot/StrategyAccordion.tsx
git commit -m "feat(bot): strategy accordion with start/stop control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: AssetCard 컴포넌트 (자산 요약 + 라인차트)

**레포:** `/home/server/trading`

**Files:**
- Create: `src/components/bot/AssetCard.tsx`

- [ ] **Step 1: `src/components/bot/AssetCard.tsx` 작성**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { createChart, ColorType, AreaSeries, UTCTimestamp, IChartApi } from 'lightweight-charts'
import { PortfolioPoint } from '@/lib/bot-api'
import { formatUsd, formatPct, pnlColorClass } from '@/lib/bot-format'

export default function AssetCard({ history, budget }: { history: PortfolioPoint[]; budget: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null)

  const latest = history.length > 0 ? parseFloat(history[history.length - 1].equity) : budget
  const pnl = latest - budget
  const pnlFraction = budget ? pnl / budget : 0

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#030712' }, textColor: '#9ca3af' },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      width: containerRef.current.clientWidth,
      height: 56,
      timeScale: { visible: false },
      rightPriceScale: { visible: false },
      handleScroll: false, handleScale: false,
    })
    const series = chart.addSeries(AreaSeries, {
      lineColor: '#34d399', topColor: 'rgba(52,211,153,0.25)', bottomColor: 'rgba(52,211,153,0)', lineWidth: 2,
    })
    chartRef.current = chart
    seriesRef.current = series
    const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth })
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.remove() }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(history.map((h) => ({
      time: Math.floor(new Date(h.timestamp).getTime() / 1000) as UTCTimestamp,
      value: parseFloat(h.equity),
    })))
    chartRef.current?.timeScale().fitContent()
  }, [history])

  return (
    <div className="bg-gray-900 rounded-xl p-3">
      <div className="text-gray-400 text-[10px]">총 자산</div>
      <div className="text-white text-xl font-bold">{formatUsd(latest)}</div>
      <div className={`text-xs ${pnlColorClass(pnl)}`}>
        {pnl >= 0 ? '+' : ''}{formatUsd(pnl)} ({formatPct(pnlFraction)})
      </div>
      <div className="mt-2 rounded-md overflow-hidden">
        {history.length === 0
          ? <div className="h-14 flex items-center justify-center text-gray-600 text-[11px]">자산 기록 없음</div>
          : <div ref={containerRef} className="w-full" />}
      </div>
    </div>
  )
}
```

> 주의: `history.length === 0`이면 차트 컨테이너가 렌더되지 않아 `useEffect`의 setData는 빈 배열로 안전. 데이터가 생기면 리렌더되며 컨테이너가 나타난다.

- [ ] **Step 2: 타입체크**

Run: `cd /home/server/trading && npx tsc --noEmit`
Expected: 에러 없음 (`AreaSeries`는 lightweight-charts v5 export)

- [ ] **Step 3: Commit**

```bash
cd /home/server/trading
git add src/components/bot/AssetCard.tsx
git commit -m "feat(bot): asset summary card with area chart

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 서브탭 3종 (Overview / Positions / Trades)

**레포:** `/home/server/trading`

**Files:**
- Create: `src/components/bot/OverviewTab.tsx`
- Create: `src/components/bot/PositionsTab.tsx`
- Create: `src/components/bot/TradesTab.tsx`

- [ ] **Step 1: `src/components/bot/OverviewTab.tsx` 작성**

```tsx
'use client'

import { Performance } from '@/lib/bot-api'
import { formatPct, pnlColorClass } from '@/lib/bot-format'

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-2.5">
      <div className="text-gray-500 text-[9px]">{label}</div>
      <div className={`text-sm font-bold ${color ?? 'text-gray-200'}`}>{value}</div>
    </div>
  )
}

export default function OverviewTab({ perf }: { perf: Performance | null }) {
  if (!perf) {
    return <p className="text-gray-500 text-sm text-center py-6">장 마감 후 집계됩니다</p>
  }
  const dr = parseFloat(perf.daily_return)
  const win = perf.win_rate != null ? `${(parseFloat(perf.win_rate) * 100).toFixed(0)}%` : '—'
  const sharpe = perf.sharpe_ratio != null ? parseFloat(perf.sharpe_ratio).toFixed(2) : '—'
  const mdd = perf.drawdown != null ? `-${(parseFloat(perf.drawdown) * 100).toFixed(1)}%` : '—'
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Metric label="오늘 수익률" value={formatPct(dr)} color={pnlColorClass(dr)} />
      <Metric label="승률" value={win} />
      <Metric label="Sharpe" value={sharpe} />
      <Metric label="MDD" value={mdd} color={perf.drawdown != null ? 'text-red-400' : undefined} />
    </div>
  )
}
```

- [ ] **Step 2: `src/components/bot/PositionsTab.tsx` 작성**

```tsx
'use client'

import { Position } from '@/lib/bot-api'
import { formatUsd, formatPct, pnlColorClass } from '@/lib/bot-format'

export default function PositionsTab({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-6">현재 보유 포지션 없음</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {positions.map((p) => {
        const pl = parseFloat(p.unrealized_pl)
        const plpc = parseFloat(p.unrealized_plpc)
        return (
          <div key={p.symbol} className="bg-gray-900 rounded-lg p-2.5 flex justify-between items-center">
            <div>
              <div className="text-white text-sm font-semibold">{p.symbol}</div>
              <div className="text-gray-500 text-[9px]">{parseFloat(p.qty)}주 · 평균 {formatUsd(p.avg_entry_price)}</div>
            </div>
            <div className="text-right">
              <div className={`text-xs font-semibold ${pnlColorClass(pl)}`}>{pl >= 0 ? '+' : ''}{formatUsd(pl)}</div>
              <div className={`text-[9px] ${pnlColorClass(plpc)}`}>{formatPct(plpc)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: `src/components/bot/TradesTab.tsx` 작성**

```tsx
'use client'

import { Trade } from '@/lib/bot-api'
import { formatUsd, formatKstDateTime } from '@/lib/bot-format'

export default function TradesTab({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-6">체결 내역 없음</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {trades.map((t) => {
        const buy = t.side === 'buy'
        return (
          <div key={t.id} className="bg-gray-900 rounded-lg p-2.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className={`text-[8px] px-1.5 py-0.5 rounded ${buy ? 'bg-emerald-900 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                {buy ? 'BUY' : 'SELL'}
              </span>
              <span className="text-gray-200 text-xs">{t.symbol}</span>
              <span className="text-gray-500 text-[9px]">{parseFloat(t.qty)}주</span>
            </div>
            <div className="text-right">
              <div className="text-gray-300 text-[11px]">{formatUsd(t.price)}</div>
              <div className="text-gray-600 text-[9px]">{formatKstDateTime(t.filled_at)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: 타입체크**

Run: `cd /home/server/trading && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
cd /home/server/trading
git add src/components/bot/OverviewTab.tsx src/components/bot/PositionsTab.tsx src/components/bot/TradesTab.tsx
git commit -m "feat(bot): overview/positions/trades sub-tab components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: /bot 페이지 (조립 + 폴링 + 새로고침)

**레포:** `/home/server/trading`

**Files:**
- Create: `src/app/bot/page.tsx`

- [ ] **Step 1: `src/app/bot/page.tsx` 작성**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import ComparisonChart, { ComparisonLine, STRATEGY_COLORS } from '@/components/bot/ComparisonChart'
import StrategyAccordion from '@/components/bot/StrategyAccordion'
import AssetCard from '@/components/bot/AssetCard'
import OverviewTab from '@/components/bot/OverviewTab'
import PositionsTab from '@/components/bot/PositionsTab'
import TradesTab from '@/components/bot/TradesTab'
import {
  Strategy, PortfolioPoint, Performance, Trade, Position,
  getStrategies, getPortfolio, getPerformance, getTrades, getPositions,
} from '@/lib/bot-api'
import { Period, tabLabel, buildComparisonSeries } from '@/lib/bot-format'

type SubTab = 'overview' | 'positions' | 'trades'
const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'overview', label: '개요' }, { id: 'positions', label: '포지션' }, { id: 'trades', label: '체결' },
]
const POLL_MS = 30_000

export default function BotPage() {
  const [strategies, setStrategies] = useState<Strategy[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [period, setPeriod] = useState<Period>('30d')
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const [lines, setLines] = useState<ComparisonLine[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioPoint[]>([])
  const [perf, setPerf] = useState<Performance | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const inFlight = useRef(false)

  // selectedId를 ref로도 들고 있어 폴링 클로저가 항상 최신값 참조
  const selectedRef = useRef<number | null>(null)
  selectedRef.current = selectedId

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const strats = await getStrategies()
      setStrategies(strats)
      setError(false)

      // 선택 전략 결정 (없으면 첫 번째)
      let sel = selectedRef.current
      if (sel === null || !strats.some((s) => s.id === sel)) {
        sel = strats.length > 0 ? strats[0].id : null
        setSelectedId(sel)
      }

      // 비교차트: 전체 전략 portfolio 병렬
      const portfolios = await Promise.all(
        strats.map((s) => getPortfolio(s.id).catch(() => [] as PortfolioPoint[])),
      )
      const newLines: ComparisonLine[] = strats.map((s, i) => {
        const series = buildComparisonSeries(portfolios[i], parseFloat(s.budget))
        return {
          id: s.id, label: tabLabel(s.name, s.id), color: STRATEGY_COLORS[i % STRATEGY_COLORS.length],
          series, lastPct: series.length > 0 ? series[series.length - 1].value : 0,
        }
      })
      setLines(newLines)

      // 선택 전략 상세
      if (sel !== null) {
        const idx = strats.findIndex((s) => s.id === sel)
        setPortfolio(idx >= 0 ? portfolios[idx] : [])
        const [pf, ps, tr] = await Promise.all([
          getPerformance(sel).catch(() => [] as Performance[]),
          getPositions(sel).catch(() => [] as Position[]),
          getTrades(sel).catch(() => [] as Trade[]),
        ])
        setPerf(pf.length > 0 ? pf[pf.length - 1] : null)
        setPositions(ps)
        setTrades(tr)
      }
    } catch {
      setError(true)
    } finally {
      inFlight.current = false
    }
  }, [])

  // 최초 로드 + 선택 전략 변경 시 재로드
  useEffect(() => { load() }, [load, selectedId])

  // 30초 폴링 (탭 비활성 시 정지)
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const manualRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const selected = strategies?.find((s) => s.id === selectedId) ?? null
  const selectedColor = STRATEGY_COLORS[
    Math.max(0, strategies?.findIndex((s) => s.id === selectedId) ?? 0) % STRATEGY_COLORS.length]

  return (
    <>
      <TopBar title="봇 대시보드" action={
        <button onClick={manualRefresh} disabled={refreshing} className="text-gray-400 disabled:opacity-50">
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      } />

      <div className="p-4 space-y-4">
        {error && <p className="text-red-400 text-sm">데이터를 불러올 수 없습니다.</p>}

        {strategies === null ? (
          <div className="animate-pulse h-40 bg-gray-800 rounded-xl" />
        ) : strategies.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">등록된 전략이 없습니다.</p>
        ) : (
          <>
            <ComparisonChart lines={lines} period={period} onPeriodChange={setPeriod} />

            {/* 전략 탭 */}
            <div className="flex border-b border-gray-800 overflow-x-auto">
              {strategies.map((s) => (
                <button key={s.id} onClick={() => { setSelectedId(s.id); setSubTab('overview') }}
                  className={`px-3 py-2 text-xs whitespace-nowrap ${
                    s.id === selectedId ? 'text-white border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}>
                  {tabLabel(s.name, s.id)}
                </button>
              ))}
            </div>

            {selected && (
              <div className="space-y-3">
                <StrategyAccordion strategy={selected} color={selectedColor} onChanged={load} />
                <AssetCard history={portfolio} budget={parseFloat(selected.budget)} />

                {/* 서브탭 */}
                <div className="flex border-b border-gray-800">
                  {SUBTABS.map((st) => (
                    <button key={st.id} onClick={() => setSubTab(st.id)}
                      className={`px-3 py-2 text-xs ${
                        subTab === st.id ? 'text-white border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}>
                      {st.label}
                    </button>
                  ))}
                </div>

                {subTab === 'overview' && <OverviewTab perf={perf} />}
                {subTab === 'positions' && <PositionsTab positions={positions} />}
                {subTab === 'trades' && <TradesTab trades={trades} />}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `cd /home/server/trading && npx tsc --noEmit && npm run build`
Expected: 타입 에러 없음, 빌드 성공 (`/bot` 라우트가 빌드 출력에 포함)

- [ ] **Step 3: Commit**

```bash
cd /home/server/trading
git add src/app/bot/page.tsx
git commit -m "feat(bot): /bot dashboard page (polling + manual refresh)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: 환경변수 + 실동작 검증

**레포:** `/home/server/trading`

**Files:**
- Create/Modify: `.env.local` (gitignore 확인)

- [ ] **Step 1: `.env.local`에 봇 API URL 추가**

`.env.local`에 다음 줄 추가 (없으면 생성). 브라우저에서 접근하므로 서버 IP 사용:
```
NEXT_PUBLIC_BOT_API_URL=http://192.168.0.8:8000
```
> 로컬 PC에서 개발 서버를 보는 경우 `localhost:8000`도 가능하지만, 다른 기기(폰 등)에서 접속하면 서버 IP여야 함. 봇 서버 `.env`의 `CORS_ORIGINS`에 이 프론트의 origin(`http://192.168.0.8:3000` 등)이 포함돼야 함 — 누락 시 Task 10 Step 4에서 CORS 에러로 드러남.

- [ ] **Step 2: `.env.local`이 gitignore되는지 확인**

Run: `cd /home/server/trading && git check-ignore .env.local && echo IGNORED`
Expected: `IGNORED` (아니면 `.gitignore`에 `.env.local` 추가)

- [ ] **Step 3: 봇 서버 CORS에 프론트 origin 반영 (필요 시)**

봇 서버(`/home/server/tradingbot/.env`)의 `CORS_ORIGINS`를 프론트 origin 포함하도록 수정 후 재기동:
```
CORS_ORIGINS=http://localhost:3000,http://192.168.0.8:3000
```
Run: `cd /home/server/tradingbot && docker compose up -d`

- [ ] **Step 4: 개발 서버 실행 후 수동 검증**

Run: `cd /home/server/trading && npm run dev` (백그라운드)
브라우저에서 `http://192.168.0.8:3000/bot` 접속 후 확인:
- 비교차트에 전략 4개 라인 표시
- 전략 탭 v1~v4 전환 동작
- 아코디언 펼침/접힘, start/stop 버튼 → 확인 다이얼로그 → 상태 배지 변경
- 서브탭 개요/포지션/체결 전환, 각 데이터 또는 빈 상태 문구 표시
- 새로고침 버튼 클릭 시 아이콘 회전 + 데이터 갱신
- 30초 후 자동 갱신 (네트워크 탭에서 재요청 확인)

> 장 마감 시간대에는 포지션/체결/성과가 비어 빈 상태 문구가 정상이다. 비교차트·자산차트는 portfolio_history(5분 기록)가 쌓였으면 표시된다.

- [ ] **Step 5: 최종 커밋 (잔여 변경 있으면)**

```bash
cd /home/server/trading
git add -A
git commit -m "chore(bot): env config for bot dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" || echo "no changes"
```

---

## 전체 검증 체크리스트

- [ ] 봇 서버: `pytest tests/test_api.py` 전체 통과 (9개)
- [ ] 프론트: `npx jest` 통과 (bot-format 6 + bot-api 3 + 기존)
- [ ] 프론트: `npx tsc --noEmit` 에러 없음
- [ ] 프론트: `npm run build` 성공
- [ ] `/bot` 수동 검증 (Task 10 Step 4) 통과
