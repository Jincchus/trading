# Stock Trading App — Phase 6: 환전 추적 + 세금

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wise CSV 업로드로 환전 기록 관리, 환차익/손실 계산, 매도 시 세금 기록 자동 생성, 양도소득세 Excel 신고서 다운로드

**Architecture:** `src/lib/exchange-rate.ts`가 ExchangeRate-API를 직접 호출하는 헬퍼. FxRecord(환전 기록)와 TaxRecord(양도 내역)는 Phase 1 스키마 그대로 사용. 매도 주문 체결 시 orders API에서 TaxRecord 자동 생성. Excel 출력은 xlsx 패키지(이미 설치됨) 사용.

**Tech Stack:** ExchangeRate-API, papaparse (Wise CSV), xlsx (Excel 출력), Prisma FxRecord/TaxRecord, Next.js API Routes

---

## 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── exchange-rate/route.ts          # GET 현재 KRW/USD 환율
│   │   ├── fx-records/
│   │   │   ├── route.ts                    # GET/POST FX 기록
│   │   │   ├── [id]/route.ts              # DELETE
│   │   │   └── wise/route.ts              # POST (Wise CSV 업로드)
│   │   ├── tax-records/
│   │   │   ├── route.ts                    # GET 세금 기록
│   │   │   └── export/route.ts            # GET Excel 다운로드
│   │   └── orders/route.ts                # 수정: 매도 체결 시 TaxRecord 생성
│   └── assets/
│       └── page.tsx                        # 자산관리 페이지 (scaffold 교체)
├── components/
│   └── assets/
│       ├── FxSummary.tsx                   # 총 투입 원화 + 환차익/손실
│       ├── FxRecordList.tsx                # 환전 기록 목록
│       ├── FxRecordForm.tsx                # 수동 환전 기록 추가
│       ├── WiseCsvUpload.tsx               # Wise CSV 업로드
│       ├── TaxGuide.tsx                    # 양도소득세 안내
│       └── TaxExport.tsx                   # Excel 다운로드 버튼
└── lib/
    ├── exchange-rate.ts                    # getCurrentKrwRate() 헬퍼
    └── wise-parser.ts                      # parseWiseCsv() 함수
__tests__/
├── lib/
│   └── wise-parser.test.ts
└── app/api/
    ├── exchange-rate.test.ts
    ├── fx-records/
    │   ├── fx-records.test.ts
    │   └── fx-records-id.test.ts
    └── tax-records/
        └── tax-records.test.ts
```

---

## Task 1: Exchange Rate 헬퍼 + API

**Files:**
- Create: `src/lib/exchange-rate.ts`
- Create: `src/app/api/exchange-rate/route.ts`
- Create: `__tests__/app/api/exchange-rate.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/exchange-rate.test.ts
import { GET } from '@/app/api/exchange-rate/route'

jest.mock('@/lib/exchange-rate', () => ({
  getCurrentKrwRate: jest.fn().mockResolvedValue(1320.5),
}))

test('GET returns current KRW/USD rate', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.rate).toBe(1320.5)
  expect(data.base).toBe('USD')
  expect(data.target).toBe('KRW')
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest exchange-rate.test
```

Expected: FAIL

- [ ] **Step 3: exchange-rate.ts 헬퍼 구현**

```typescript
// src/lib/exchange-rate.ts
import { env } from './env'

export async function getCurrentKrwRate(): Promise<number> {
  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${env.EXCHANGE_RATE_API_KEY}/latest/USD`
    )
    if (!res.ok) return 1300
    const data = await res.json() as { conversion_rates?: { KRW?: number } }
    return data.conversion_rates?.KRW ?? 1300
  } catch {
    return 1300
  }
}
```

- [ ] **Step 4: exchange-rate/route.ts 구현**

```typescript
// src/app/api/exchange-rate/route.ts
import { NextResponse } from 'next/server'
import { getCurrentKrwRate } from '@/lib/exchange-rate'

export async function GET() {
  const rate = await getCurrentKrwRate()
  return NextResponse.json({ rate, base: 'USD', target: 'KRW' })
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest exchange-rate.test
```

Expected: PASS — 1 test

- [ ] **Step 6: 커밋**

```bash
git add src/lib/exchange-rate.ts src/app/api/exchange-rate/route.ts __tests__/app/api/exchange-rate.test.ts
git commit -m "Feat: add exchange rate helper and API"
```

---

## Task 2: FX Records CRUD API

**Files:**
- Create: `src/app/api/fx-records/route.ts`
- Create: `src/app/api/fx-records/[id]/route.ts`
- Create: `__tests__/app/api/fx-records/fx-records.test.ts`
- Create: `__tests__/app/api/fx-records/fx-records-id.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/fx-records/fx-records.test.ts
import { GET, POST } from '@/app/api/fx-records/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    fxRecord: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'fx-1', date: new Date('2024-01-15'), krwAmount: 1300000, usdAmount: 1000, exchangeRate: 1300, source: 'wise', createdAt: new Date() },
      ]),
      create: jest.fn().mockResolvedValue(
        { id: 'fx-2', date: new Date('2024-02-01'), krwAmount: 650000, usdAmount: 500, exchangeRate: 1300, source: 'manual', createdAt: new Date() }
      ),
    },
  },
}))

test('GET returns fx records ordered by date desc', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.records).toHaveLength(1)
  expect(data.records[0].source).toBe('wise')
})

test('POST creates manual fx record', async () => {
  const req = new NextRequest('http://localhost/api/fx-records', {
    method: 'POST',
    body: JSON.stringify({ date: '2024-02-01', krwAmount: 650000, usdAmount: 500 }),
  })
  const res = await POST(req)
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.record.source).toBe('manual')
})

test('POST returns 400 for invalid amounts', async () => {
  const req = new NextRequest('http://localhost/api/fx-records', {
    method: 'POST',
    body: JSON.stringify({ date: '2024-02-01', krwAmount: -100, usdAmount: 500 }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
```

```typescript
// __tests__/app/api/fx-records/fx-records-id.test.ts
import { DELETE } from '@/app/api/fx-records/[id]/route'
import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  prisma: {
    fxRecord: {
      delete: jest.fn().mockResolvedValue({}),
    },
  },
}))

test('DELETE removes fx record', async () => {
  const res = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'fx-1' }) })
  expect((await res.json()).ok).toBe(true)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest fx-records.test fx-records-id.test
```

Expected: FAIL

- [ ] **Step 3: fx-records/route.ts 구현**

```typescript
// src/app/api/fx-records/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const records = await prisma.fxRecord.findMany({
    orderBy: { date: 'desc' },
  })
  return NextResponse.json({ records })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { date?: string; krwAmount?: number; usdAmount?: number }

    if (!body.date || !body.krwAmount || !body.usdAmount) {
      return NextResponse.json({ error: 'date, krwAmount, usdAmount required' }, { status: 400 })
    }
    if (body.krwAmount <= 0 || body.usdAmount <= 0) {
      return NextResponse.json({ error: 'Amounts must be positive' }, { status: 400 })
    }

    const record = await prisma.fxRecord.create({
      data: {
        date: new Date(body.date),
        krwAmount: body.krwAmount,
        usdAmount: body.usdAmount,
        exchangeRate: body.krwAmount / body.usdAmount,
        source: 'manual',
      },
    })
    return NextResponse.json({ record }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: fx-records/[id]/route.ts 구현**

```typescript
// src/app/api/fx-records/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.fxRecord.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest fx-records.test fx-records-id.test
```

Expected: PASS — 4 tests

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/fx-records/route.ts src/app/api/fx-records/[id]/route.ts __tests__/app/api/fx-records/
git commit -m "Feat: add FX records CRUD API"
```

---

## Task 3: Wise CSV 파서 + 업로드 API

**Files:**
- Create: `src/lib/wise-parser.ts`
- Create: `src/app/api/fx-records/wise/route.ts`
- Create: `__tests__/lib/wise-parser.test.ts`

- [ ] **Step 1: 파서 테스트 작성**

```typescript
// __tests__/lib/wise-parser.test.ts
import { parseWiseCsv } from '@/lib/wise-parser'

const SAMPLE_CSV = `TransferWise ID,Date,Amount,Currency,Description,Payment Reference,Running Balance,Exchange From,Exchange To,Exchange Rate,Payer Name,Payee Name
TW-001,2024-01-15,769.23,USD,Converted from KRW to USD,,769.23,1000000 KRW,769.23 USD,1300.00,,
TW-002,2024-01-20,384.62,USD,Converted from KRW to USD,,1153.85,500000 KRW,384.62 USD,1300.00,,
TW-003,2024-01-25,100.00,EUR,Transfer to friend,,1053.85,,,,,
`

test('parseWiseCsv extracts KRW→USD conversions only', () => {
  const result = parseWiseCsv(SAMPLE_CSV)
  expect(result).toHaveLength(2)
})

test('parseWiseCsv extracts correct amounts', () => {
  const result = parseWiseCsv(SAMPLE_CSV)
  expect(result[0].krwAmount).toBe(1000000)
  expect(result[0].usdAmount).toBe(769.23)
  expect(result[0].exchangeRate).toBeCloseTo(1300, 0)
})

test('parseWiseCsv parses dates correctly', () => {
  const result = parseWiseCsv(SAMPLE_CSV)
  expect(result[0].date.toISOString().slice(0, 10)).toBe('2024-01-15')
})

test('parseWiseCsv ignores non-KRW-to-USD rows', () => {
  const result = parseWiseCsv(SAMPLE_CSV)
  expect(result.every((r) => r.source === 'wise')).toBe(true)
  // EUR transfer should not be included
  expect(result).toHaveLength(2)
})

test('parseWiseCsv returns empty array for empty CSV', () => {
  expect(parseWiseCsv('Date,Amount,Currency\n')).toHaveLength(0)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest wise-parser.test
```

Expected: FAIL

- [ ] **Step 3: wise-parser.ts 구현**

```typescript
// src/lib/wise-parser.ts
import Papa from 'papaparse'

export interface WiseFxEntry {
  date: Date
  krwAmount: number
  usdAmount: number
  exchangeRate: number
  source: 'wise'
}

export function parseWiseCsv(csvText: string): WiseFxEntry[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  return result.data
    .filter((row) => {
      const exchangeFrom = row['Exchange From'] ?? ''
      const exchangeTo = row['Exchange To'] ?? ''
      return (
        exchangeFrom.toUpperCase().includes('KRW') &&
        exchangeTo.toUpperCase().includes('USD')
      )
    })
    .map((row) => {
      const krwRaw = (row['Exchange From'] ?? '').replace(/[^0-9.]/g, '')
      const usdRaw = (row['Amount'] ?? '').replace(/[^0-9.]/g, '')
      const krwAmount = parseFloat(krwRaw)
      const usdAmount = parseFloat(usdRaw)

      return {
        date: new Date(row['Date'] ?? ''),
        krwAmount,
        usdAmount,
        exchangeRate: usdAmount > 0 ? krwAmount / usdAmount : 0,
        source: 'wise' as const,
      }
    })
    .filter(
      (e) =>
        !isNaN(e.krwAmount) &&
        !isNaN(e.usdAmount) &&
        e.usdAmount > 0 &&
        e.krwAmount > 0 &&
        !isNaN(e.date.getTime())
    )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest wise-parser.test
```

Expected: PASS — 5 tests

- [ ] **Step 5: wise/route.ts 구현 (CSV 업로드)**

```typescript
// src/app/api/fx-records/wise/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseWiseCsv } from '@/lib/wise-parser'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const entries = parseWiseCsv(text)

    let created = 0
    for (const entry of entries) {
      const existing = await prisma.fxRecord.findFirst({
        where: {
          source: 'wise',
          date: entry.date,
          krwAmount: entry.krwAmount,
          usdAmount: entry.usdAmount,
        },
      })
      if (!existing) {
        await prisma.fxRecord.create({ data: entry })
        created++
      }
    }

    return NextResponse.json({ parsed: entries.length, created })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 6: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/wise-parser.ts src/app/api/fx-records/wise/ __tests__/lib/wise-parser.test.ts
git commit -m "Feat: add Wise CSV parser and upload API"
```

---

## Task 4: Orders API 수정 — 매도 체결 시 TaxRecord 생성

**Files:**
- Modify: `src/app/api/orders/route.ts`

- [ ] **Step 1: 기존 테스트에 mock 추가**

`__tests__/app/api/orders/orders.test.ts`를 읽고, 파일 상단 jest.mock 블록들 아래에 아래 두 줄 추가:

```typescript
jest.mock('@/lib/exchange-rate', () => ({
  getCurrentKrwRate: jest.fn().mockResolvedValue(1300),
}))
```

그리고 기존 `jest.mock('@/lib/db', ...)` 내 `prisma.lot` 오브젝트에 `taxRecord` 속성 추가:
```typescript
taxRecord: {
  create: jest.fn().mockResolvedValue({}),
},
```

그리고 'POST updates Lot soldQuantity when sell fills' 테스트 마지막에 추가:
```typescript
  const { prisma } = jest.requireMock('@/lib/db')
  expect(prisma.taxRecord.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ ticker: 'AAPL', quantity: 3, lotId: 'lot-1' }),
    })
  )
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest orders.test
```

Expected: FAIL — taxRecord.create not called

- [ ] **Step 3: orders/route.ts 수정**

`src/app/api/orders/route.ts`를 읽고, 파일 상단에 import 추가:
```typescript
import { getCurrentKrwRate } from '@/lib/exchange-rate'
```

기존 sell 처리 블록:
```typescript
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
```

교체:
```typescript
    if (
      body.side === 'sell' &&
      body.lotId &&
      order.status === 'filled' &&
      order.filled_qty &&
      order.filled_avg_price &&
      order.filled_at
    ) {
      const filledQty = parseFloat(order.filled_qty)
      const salePrice = parseFloat(order.filled_avg_price)
      const lot = await prisma.lot.findUnique({ where: { id: body.lotId } })
      if (lot) {
        const newSold = lot.soldQuantity + filledQty
        const saleRate = await getCurrentKrwRate()
        const gainKrw = (salePrice - lot.purchasePrice) * filledQty * saleRate

        await Promise.all([
          prisma.lot.update({
            where: { id: body.lotId },
            data: {
              soldQuantity: newSold,
              status: newSold >= lot.quantity ? 'fully_sold' : 'active',
            },
          }),
          prisma.taxRecord.create({
            data: {
              lotId: body.lotId,
              ticker: lot.ticker,
              acquireDate: lot.purchaseDate,
              acquirePrice: lot.purchasePrice,
              acquireRate: saleRate,
              saleDate: new Date(order.filled_at),
              salePrice,
              saleRate,
              quantity: filledQty,
              gainKrw,
            },
          }),
        ])
      }
    }
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest orders.test
```

Expected: 모든 orders tests PASS

- [ ] **Step 5: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/orders/route.ts __tests__/app/api/orders/orders.test.ts
git commit -m "Feat: create TaxRecord automatically on sell order fill"
```

---

## Task 5: Tax Records API + Excel Export

**Files:**
- Create: `src/app/api/tax-records/route.ts`
- Create: `src/app/api/tax-records/export/route.ts`
- Create: `__tests__/app/api/tax-records/tax-records.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// __tests__/app/api/tax-records/tax-records.test.ts
import { GET } from '@/app/api/tax-records/route'

jest.mock('@/lib/db', () => ({
  prisma: {
    taxRecord: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tr-1', lotId: 'lot-1', ticker: 'AAPL',
          acquireDate: new Date('2024-01-15'), acquirePrice: 150, acquireRate: 1300,
          saleDate: new Date('2024-03-01'), salePrice: 175, saleRate: 1320,
          quantity: 3, gainKrw: 99000, createdAt: new Date(),
        },
      ]),
    },
  },
}))

test('GET returns tax records with summary', async () => {
  const res = await GET()
  const data = await res.json()
  expect(data.records).toHaveLength(1)
  expect(data.totalGainKrw).toBe(99000)
  expect(data.taxableGainKrw).toBe(0) // 99000 - 2500000 < 0
  expect(data.estimatedTaxKrw).toBe(0)
})

test('GET calculates taxable gain correctly when exceeds exemption', async () => {
  const { prisma } = jest.requireMock('@/lib/db')
  prisma.taxRecord.findMany.mockResolvedValueOnce([
    {
      id: 'tr-1', lotId: 'lot-1', ticker: 'AAPL',
      acquireDate: new Date('2024-01-15'), acquirePrice: 100, acquireRate: 1300,
      saleDate: new Date('2024-03-01'), salePrice: 200, saleRate: 1320,
      quantity: 100, gainKrw: 13200000, createdAt: new Date(),
    },
  ])
  const res = await GET()
  const data = await res.json()
  expect(data.totalGainKrw).toBe(13200000)
  expect(data.taxableGainKrw).toBe(10700000) // 13200000 - 2500000
  expect(data.estimatedTaxKrw).toBeCloseTo(10700000 * 0.22, 0)
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npx jest tax-records.test
```

Expected: FAIL

- [ ] **Step 3: tax-records/route.ts 구현**

```typescript
// src/app/api/tax-records/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const EXEMPTION_KRW = 2_500_000
const TAX_RATE = 0.22

export async function GET() {
  const records = await prisma.taxRecord.findMany({
    orderBy: { saleDate: 'desc' },
  })

  const totalGainKrw = records.reduce((s, r) => s + r.gainKrw, 0)
  const taxableGainKrw = Math.max(0, totalGainKrw - EXEMPTION_KRW)
  const estimatedTaxKrw = Math.round(taxableGainKrw * TAX_RATE)

  return NextResponse.json({
    records,
    totalGainKrw,
    taxableGainKrw,
    estimatedTaxKrw,
    exemptionKrw: EXEMPTION_KRW,
  })
}
```

- [ ] **Step 4: tax-records/export/route.ts 구현 (Excel)**

```typescript
// src/app/api/tax-records/export/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

const EXEMPTION_KRW = 2_500_000
const TAX_RATE = 0.22

export async function GET() {
  const records = await prisma.taxRecord.findMany({ orderBy: { saleDate: 'asc' } })

  const headers = [
    '종목', '취득일', '취득가(USD)', '취득환율(₩/$)', '취득가(KRW)',
    '양도일', '양도가(USD)', '양도환율(₩/$)', '양도가(KRW)', '수량', '양도차익(KRW)',
  ]

  const rows = records.map((r) => [
    r.ticker,
    r.acquireDate.toISOString().slice(0, 10),
    r.acquirePrice,
    r.acquireRate,
    Math.round(r.acquirePrice * r.acquireRate),
    r.saleDate.toISOString().slice(0, 10),
    r.salePrice,
    r.saleRate,
    Math.round(r.salePrice * r.saleRate),
    r.quantity,
    Math.round(r.gainKrw),
  ])

  const totalGainKrw = records.reduce((s, r) => s + r.gainKrw, 0)
  const taxableGainKrw = Math.max(0, totalGainKrw - EXEMPTION_KRW)
  const estimatedTax = Math.round(taxableGainKrw * TAX_RATE)

  const summaryRows = [
    [],
    ['합계 양도차익', '', '', '', '', '', '', '', '', '', Math.round(totalGainKrw)],
    ['기본공제', '', '', '', '', '', '', '', '', '', -EXEMPTION_KRW],
    ['과세표준', '', '', '', '', '', '', '', '', '', Math.round(taxableGainKrw)],
    ['세율', '', '', '', '', '', '', '', '', '', '22%'],
    ['납부세액(예상)', '', '', '', '', '', '', '', '', '', estimatedTax],
  ]

  const wsData = [headers, ...rows, ...summaryRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = headers.map(() => ({ wch: 16 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '양도소득세')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tax-${new Date().getFullYear()}.xlsx"`,
    },
  })
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest tax-records.test
```

Expected: PASS — 2 tests

- [ ] **Step 6: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (85+ tests)

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/tax-records/ __tests__/app/api/tax-records/
git commit -m "Feat: add tax records API with summary and Excel export"
```

---

## Task 6: FxSummary + FxRecordList + FxRecordForm + WiseCsvUpload

**Files:**
- Create: `src/components/assets/FxSummary.tsx`
- Create: `src/components/assets/FxRecordList.tsx`
- Create: `src/components/assets/FxRecordForm.tsx`
- Create: `src/components/assets/WiseCsvUpload.tsx`

- [ ] **Step 1: FxSummary.tsx 작성**

```typescript
// src/components/assets/FxSummary.tsx
'use client'

import { useEffect, useState } from 'react'

interface FxRecord {
  krwAmount: number
  usdAmount: number
}

export default function FxSummary() {
  const [totalKrwInvested, setTotalKrwInvested] = useState<number | null>(null)
  const [currentKrwValue, setCurrentKrwValue] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/fx-records').then((r) => r.json()),
      fetch('/api/exchange-rate').then((r) => r.json()),
      fetch('/api/account').then((r) => r.json()),
    ])
      .then(([fxData, rateData, accountData]) => {
        const invested = (fxData.records as FxRecord[]).reduce((s, r) => s + r.krwAmount, 0)
        const equity = parseFloat(accountData.equity ?? '0')
        const rate = rateData.rate ?? 1300
        setTotalKrwInvested(invested)
        setCurrentKrwValue(equity * rate)
      })
      .catch(() => {})
  }, [])

  const fxPnL = currentKrwValue !== null && totalKrwInvested !== null
    ? currentKrwValue - totalKrwInvested
    : null

  const fmt = (v: number) =>
    v.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' })

  if (totalKrwInvested === null) {
    return <div className="animate-pulse h-28 bg-gray-800 rounded-xl" />
  }

  const isUp = (fxPnL ?? 0) >= 0

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-3">환전 현황</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">총 투입 원화</p>
          <p className="text-white font-semibold">{fmt(totalKrwInvested)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">현재 KRW 환산가</p>
          <p className="text-white font-semibold">{currentKrwValue !== null ? fmt(currentKrwValue) : '-'}</p>
        </div>
        {fxPnL !== null && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-0.5">환차익/손실</p>
            <p className={`font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{fmt(fxPnL)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: FxRecordList.tsx 작성**

```typescript
// src/components/assets/FxRecordList.tsx
'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

interface FxRecord {
  id: string
  date: string
  krwAmount: number
  usdAmount: number
  exchangeRate: number
  source: string
}

interface Props {
  refreshKey?: number
}

export default function FxRecordList({ refreshKey }: Props) {
  const [records, setRecords] = useState<FxRecord[]>([])

  const load = () =>
    fetch('/api/fx-records').then((r) => r.json()).then((d) => setRecords(d.records ?? []))

  useEffect(() => { load() }, [refreshKey])

  const remove = async (id: string) => {
    await fetch(`/api/fx-records/${id}`, { method: 'DELETE' })
    load()
  }

  if (records.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">환전 기록이 없습니다.</p>
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
          <div>
            <p className="text-white text-sm">
              {r.krwAmount.toLocaleString()}원 → ${r.usdAmount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">
              {r.date.slice(0, 10)} · {r.exchangeRate.toFixed(0)}원/$ · {r.source === 'wise' ? 'Wise' : '수동'}
            </p>
          </div>
          <button onClick={() => remove(r.id)} className="text-gray-500 hover:text-red-400 p-1">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: FxRecordForm.tsx 작성**

```typescript
// src/components/assets/FxRecordForm.tsx
'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function FxRecordForm({ onSuccess }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [krwAmount, setKrwAmount] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!krwAmount || !usdAmount) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/fx-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, krwAmount: parseFloat(krwAmount), usdAmount: parseFloat(usdAmount) }),
      })
      if (res.ok) {
        setKrwAmount('')
        setUsdAmount('')
        onSuccess?.()
      } else {
        const d = await res.json()
        setError(d.error ?? '추가 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setSubmitting(false)
    }
  }

  const rate = krwAmount && usdAmount
    ? (parseFloat(krwAmount) / parseFloat(usdAmount)).toFixed(0)
    : null

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h3 className="text-white font-semibold">환전 기록 추가</h3>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none"
      />

      <div className="flex gap-2">
        <input
          type="number"
          value={krwAmount}
          onChange={(e) => setKrwAmount(e.target.value)}
          placeholder="원화 금액 (예: 1300000)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
        <input
          type="number"
          value={usdAmount}
          onChange={(e) => setUsdAmount(e.target.value)}
          placeholder="달러 수령액 (예: 1000)"
          className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
        />
      </div>

      {rate && (
        <p className="text-xs text-gray-400">환율: {rate}원/$</p>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting || !krwAmount || !usdAmount}
        className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl disabled:opacity-40 font-medium"
      >
        {submitting ? '추가 중...' : '환전 기록 추가'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: WiseCsvUpload.tsx 작성**

```typescript
// src/components/assets/WiseCsvUpload.tsx
'use client'

import { useState } from 'react'

interface Props {
  onSuccess?: () => void
}

export default function WiseCsvUpload({ onSuccess }: Props) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ parsed: number; created: number } | null>(null)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/fx-records/wise', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        onSuccess?.()
      } else {
        setError(data.error ?? '업로드 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-white font-semibold mb-2">Wise CSV 업로드</h3>
      <p className="text-xs text-gray-400 mb-3">
        Wise 앱 → 거래 내역 → 다운로드(CSV) 후 업로드. KRW→USD 환전 항목만 자동 추출합니다.
      </p>

      <label className={`block w-full py-3 text-center text-sm rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
        uploading
          ? 'border-gray-700 text-gray-500'
          : 'border-blue-800 text-blue-400 hover:border-blue-600'
      }`}>
        {uploading ? '처리 중...' : 'CSV 파일 선택'}
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {result && (
        <p className="text-green-400 text-xs mt-2">
          {result.parsed}개 항목 발견 · {result.created}개 신규 저장
        </p>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: 전체 테스트 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/assets/FxSummary.tsx src/components/assets/FxRecordList.tsx src/components/assets/FxRecordForm.tsx src/components/assets/WiseCsvUpload.tsx
git commit -m "Feat: add FX tracking UI components"
```

---

## Task 7: TaxGuide + TaxExport + 자산관리 페이지 조립

**Files:**
- Create: `src/components/assets/TaxGuide.tsx`
- Create: `src/components/assets/TaxExport.tsx`
- Modify: `src/app/assets/page.tsx`

- [ ] **Step 1: src/lib/alpaca/client.ts에 getActivities 메서드 추가**

`src/lib/alpaca/client.ts`를 읽고, 반환 객체에 메서드 추가:

```typescript
export interface AlpacaActivity {
  id: string
  activity_type: string
  date: string
  net_amount: string
  symbol: string
  description: string
}
```

반환 객체에 추가:
```typescript
getActivities: (params?: { activity_type?: string; after?: string }): Promise<AlpacaActivity[]> => {
  const qs = new URLSearchParams(
    Object.entries(params || {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString()
  return req(`/v2/account/activities${qs ? `?${qs}` : ''}`)
},
```

- [ ] **Step 2: TaxGuide.tsx 작성**

```typescript
// src/components/assets/TaxGuide.tsx
'use client'

import { useEffect, useState } from 'react'

interface TaxSummary {
  totalGainKrw: number
  taxableGainKrw: number
  estimatedTaxKrw: number
  exemptionKrw: number
}

export default function TaxGuide() {
  const [summary, setSummary] = useState<TaxSummary | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/tax-records')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {})
  }, [])

  const fmt = (v: number) => v.toLocaleString('ko-KR') + '원'

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <p className="text-white font-semibold text-sm">해외주식 양도소득세</p>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {summary && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">
          <div>
            <p className="text-xs text-gray-400">올해 총 양도차익</p>
            <p className={`text-sm font-semibold ${summary.totalGainKrw >= 0 ? 'text-white' : 'text-red-400'}`}>
              {fmt(Math.round(summary.totalGainKrw))}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">기본공제</p>
            <p className="text-sm text-gray-300">{fmt(summary.exemptionKrw)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">과세표준</p>
            <p className="text-sm text-white">{fmt(Math.round(summary.taxableGainKrw))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">예상 세액 (22%)</p>
            <p className="text-sm font-semibold text-amber-400">{fmt(summary.estimatedTaxKrw)}</p>
          </div>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-800 pt-3 text-xs text-gray-400">
          <p>• 연간 해외주식 양도차익 <span className="text-white">250만원 기본공제</span></p>
          <p>• 초과분에 <span className="text-white">22% 세율</span> 적용 (지방소득세 포함)</p>
          <p>• 신고 기간: <span className="text-white">매년 5월</span> (종합소득세 신고)</p>
          <p>• 신고 방법: 홈택스 → 세금신고 → 종합소득세 → 해외주식 양도소득</p>
          <p className="text-gray-500">* 표시된 세액은 참고용이며, 정확한 신고는 전문가 상담을 권장합니다.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: DividendHistory.tsx 작성**

```typescript
// src/components/assets/DividendHistory.tsx
'use client'

import { useEffect, useState } from 'react'

interface DividendActivity {
  id: string
  date: string
  net_amount: string
  symbol: string
  description: string
}

export default function DividendHistory() {
  const [dividends, setDividends] = useState<DividendActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/account/activities?type=DIV')
      .then((r) => r.json())
      .then((d) => setDividends(d.activities ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-16 bg-gray-800 rounded-xl" />
  if (dividends.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">배당금 수령 내역</p>
        <p className="text-gray-500 text-sm">수령 내역이 없습니다.</p>
      </div>
    )
  }

  const total = dividends.reduce((s, d) => s + parseFloat(d.net_amount), 0)

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between">
        <p className="text-gray-400 text-xs uppercase tracking-wide">배당금 수령 내역</p>
        <p className="text-green-400 text-xs font-medium">총 ${total.toFixed(2)}</p>
      </div>
      {dividends.map((d) => (
        <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
          <div>
            <p className="text-white text-sm font-medium">{d.symbol}</p>
            <p className="text-xs text-gray-400">{d.date.slice(0, 10)}</p>
          </div>
          <p className="text-green-400 text-sm font-semibold">
            +${parseFloat(d.net_amount).toFixed(2)}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: GET /api/account/activities route 추가**

```typescript
// src/app/api/account/activities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { alpaca } from '@/lib/alpaca/client'

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') ?? undefined
    const activities = await alpaca.getActivities({ activity_type: type })
    return NextResponse.json({ activities })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 5: TaxExport.tsx 작성**

```typescript
// src/components/assets/TaxExport.tsx
'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export default function TaxExport() {
  const [loading, setLoading] = useState(false)

  const download = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tax-records/export')
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tax-${new Date().getFullYear()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('다운로드 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="flex items-center gap-2 w-full py-3 bg-gray-800 text-white text-sm rounded-xl disabled:opacity-40 justify-center font-medium"
    >
      <Download size={16} />
      {loading ? '생성 중...' : '세금 신고용 Excel 다운로드'}
    </button>
  )
}
```

- [ ] **Step 3: assets/page.tsx 전체 교체**

```typescript
// src/app/assets/page.tsx
'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import FxSummary from '@/components/assets/FxSummary'
import FxRecordList from '@/components/assets/FxRecordList'
import FxRecordForm from '@/components/assets/FxRecordForm'
import WiseCsvUpload from '@/components/assets/WiseCsvUpload'
import TaxGuide from '@/components/assets/TaxGuide'
import TaxExport from '@/components/assets/TaxExport'
import DividendHistory from '@/components/assets/DividendHistory'

type Tab = '환전' | '세금'

export default function AssetsPage() {
  const [tab, setTab] = useState<Tab>('환전')
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey((k) => k + 1)

  return (
    <>
      <TopBar title="자산 관리" />
      <div className="flex border-b border-gray-800 bg-gray-900">
        {(['환전', '세금'] as Tab[]).map((t) => (
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
        {tab === '환전' && (
          <>
            <FxSummary />
            <WiseCsvUpload onSuccess={refresh} />
            <FxRecordForm onSuccess={refresh} />
            <FxRecordList refreshKey={refreshKey} />
          </>
        )}

        {tab === '세금' && (
          <>
            <TaxGuide />
            <DividendHistory />
            <TaxExport />
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 4: 전체 테스트 최종 확인**

```bash
npx jest
```

Expected: 모든 테스트 PASS (90+ tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/alpaca/client.ts src/app/api/account/activities/ src/components/assets/TaxGuide.tsx src/components/assets/TaxExport.tsx src/components/assets/DividendHistory.tsx src/app/assets/page.tsx
git commit -m "Feat: assemble assets page (FX tracking + dividends + tax guide + Excel export)"
```

---

## Phase 6 완료 기준

- [ ] `npx jest` → 모든 테스트 PASS
- [ ] Wise CSV 업로드 → 환전 기록 자동 추출
- [ ] 수동 환전 기록 추가 가능
- [ ] 환차익/손실 계산 표시
- [ ] 매도 주문 체결 시 TaxRecord 자동 생성
- [ ] 세금 탭 → Excel 다운로드 → 양도소득세 신고서 확인

## 다음 단계

Phase 7 (알림 Web Push) 계획을 작성하려면 요청하세요.
