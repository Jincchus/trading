# Trading 웹 — 점검 / 보완 리포트

**날짜:** 2026-05-31
**범위:** `/home/server/trading` (Next.js 커스텀 서버 + Alpaca + Prisma/SQLite) 및 연동된 봇 서버(`/home/server/tradingbot`, :8000)
**관점:** **실제 계좌 연결을 앞두고 있으므로 "보완(안전장치·보안)"을 최우선**으로 정리. 우선순위 P0(실계좌 전 필수) → P1(보안/안정성) → P2(리팩터/품질).

> 요약: 기능은 잘 동작하지만, **자동매매 안전장치와 인증이 페이퍼 기준으로 느슨**하다. 실계좌 전에 P0 5건은 반드시 처리 권장.

---

## 🔴 P0 — 실제 계좌 연결 전 반드시

### P0-1. 자동매매 전략이 미체결 시 30초마다 중복 매도 주문을 낸다
**위치:** `src/lib/strategy-monitor.ts` (매도 루프), `server.ts` (30초 `setInterval`)
**문제:** `checkStrategies()`는 룰 충족 시 시장가 매도를 내고, **`order.status === 'filled'`일 때만** `soldQuantity`를 갱신한다. 주문이 즉시 체결되지 않으면(장 마감·유동성 부족·부분체결) DB 상태가 안 바뀌고, 30초 뒤 같은 룰이 다시 충족되어 **또 매도 주문을 낸다.** 장 마감 중 누적되면 개장 시 매도 폭탄이 될 수 있다.
**위험:** 의도치 않은 과매도 / 포지션 전량 이상 매도.
**권장:**
- "주문을 낸 사실"을 기준으로 상태를 전진시킨다(낙관적): 주문 제출 즉시 `soldQuantity`를 예약 수량만큼 증가시키거나, **룰별 "주문 진행중" 플래그/주문ID를 기록**해 같은 룰 재실행을 막는다.
- 미체결 주문은 별도 reconciliation(아래 P0-4)으로 정산.
- 장중에만 실행(시장 상태 체크) + 주문 전 미체결 주문 존재 여부 확인.

### P0-2. `ALPACA_BASE_URL` 기본값이 **라이브** 엔드포인트
**위치:** `src/lib/env.ts:7` — `.default('https://api.alpaca.markets')`
**문제:** 환경변수가 비면 **실거래 API로 폴백**한다. 현재 `.env`엔 paper로 설정돼 있지만, 한 줄 누락/오타 시 실제 자금이 거래된다.
**위험:** 사고성 실거래.
**권장:**
- 기본값을 paper(`https://paper-api.alpaca.markets`)로 바꾸거나 **기본값 제거 + 필수화**.
- `ALPACA_TRADING_MODE=paper|live` 같은 **명시적 플래그**를 두고, `live`일 때만 라이브 URL 허용 + 부팅 로그/대시보드에 모드 배지 표시.

### P0-3. 인증이 위조 가능 + 봇 서버는 무인증
**위치:** `src/middleware.ts`(쿠키값 `'authenticated'` 고정 비교), `src/app/api/login/route.ts`(쿠키 `secure` 미설정), 봇 서버 `/home/server/tradingbot/api/main.py`(인증 전무)
**문제:**
- 세션 쿠키 값이 **상수 `"authenticated"`** 라, 값만 알면 누구나 `Cookie: session=authenticated` 로 위조해 통과한다(서명/비밀 없음).
- 쿠키에 `secure` 플래그가 없어 HTTPS 배포 시 평문 전송 가능.
- **봇 API(:8000)는 인증이 전혀 없어** LAN의 누구나 `POST /strategies/{id}/start`로 실거래 전략을 켜고 끌 수 있다.
**위험:** 인증 우회 / 외부에서 거래 제어.
**권장:**
- 쿠키 값을 **HMAC 서명 토큰**(예: `payload.signature`, 서버 `SESSION_SECRET`로 검증) 또는 최소한 **부팅 시 생성한 랜덤 시크릿 값**으로. 미들웨어에서 서명 검증.
- 배포 HTTPS면 `secure: true`.
- 봇 API에 **공유 토큰 헤더 인증**(`Authorization: Bearer <BOT_API_TOKEN>`) 추가 + 프론트는 서버 라우트(프록시)에서만 호출해 토큰을 브라우저에 노출하지 않기.

### P0-4. 주문 입력 검증·한도·idempotency 부재, DB 정합성 미보장
**위치:** `src/app/api/orders/route.ts:20` (raw `as` 캐스팅), 동 파일 `Promise.all`(lot.update + taxRecord.create), 전 API 라우트(37개 중 **zod 검증 0개**)
**문제:**
- 주문 POST가 본문을 **검증 없이 그대로** Alpaca에 전달. 수량 음수/0, 비정상 notional, 잘못된 ticker가 그대로 나간다.
- **최대 주문 금액/수량 한도, 중복 제출(idempotency) 방지 없음** → 더블클릭·재시도 시 중복 주문 가능.
- 매도 후 `lot.update`와 `taxRecord.create`를 `Promise.all`로 처리 → **트랜잭션이 아니라** 한쪽 실패 시 정합성 깨짐(전 코드베이스에 `$transaction` 1곳뿐).
- 시장가 외(지정가 gtc) 주문은 동기 체결이 안 돼 **Lot가 생성되지 않음** → 포트폴리오/세금 기록 누락.
**위험:** 잘못된/중복 주문, 회계 데이터 드리프트.
**권장:**
- **zod로 주문 본문 검증** + 서버측 상한(예: 단일 주문 $ 한도, 수량>0) + `Idempotency-Key`(클라이언트 생성 UUID, Alpaca도 `client_order_id` 지원).
- 매도 후처리를 `prisma.$transaction`으로 원자화.
- **주문 reconciliation 잡**: 미체결/체결 상태를 주기적으로 폴링하거나(봇처럼 trade-updates 스트림) 체결 시 Lot/TaxRecord 생성. 동기 fill 가정 제거.

### P0-5. 스케줄러 동시 실행 가드 없음 (다중 인스턴스/장기 실행 시 중복)
**위치:** `server.ts` (recurring 60s, strategy 30s, alerts 60s `setInterval`)
**문제:** 실행 락이 없어, `checkStrategies()`가 30초 안에 안 끝나면 **이전 실행과 겹쳐** 같은 룰을 두 번 평가할 수 있다. 컨테이너를 2개 띄우면 동일 작업이 2배로 돈다.
**위험:** 중복 자동매매(특히 P0-1과 결합 시 증폭).
**권장:** 실행 중 플래그(in-flight guard)로 재진입 차단, "한 번에 하나의 스케줄러 인스턴스"를 보장(전용 워커/리더 락). 봇 프로젝트의 단일 실행 원칙과 동일하게.

---

## 🟠 P1 — 보안 / 운영 안정성

### P1-1. 로그인 무차별 대입 방어 없음
**위치:** `src/app/api/login/route.ts`
**문제:** 시도 횟수 제한/지연 없음 → 비밀번호 1개 방식이라 brute-force에 취약.
**권장:** IP당 시도 제한(예: 5회/분) + 지수 백오프, 실패 로깅.

### P1-2. 오픈 리다이렉트 가능성
**위치:** `src/app/login/page.tsx` — `router.replace(params.get('from') ?? '/')`
**문제:** `from`을 검증 없이 사용. `/login?from=https://evil.com` 으로 로그인 후 외부 유도 가능.
**권장:** `from`이 `/`로 시작하고 `//`가 아닌 **내부 경로일 때만** 허용.

### P1-3. `/ws` 가격 스트림이 무인증
**위치:** `server.ts:43` `server.on('upgrade')` — 세션 쿠키 확인 없이 업그레이드 허용
**문제:** 미들웨어는 HTTP만 보호. WebSocket 업그레이드는 커스텀 서버가 직접 처리하며 인증 체크가 없다.
**권장:** 업그레이드 시 `req.headers.cookie`에서 세션 검증 후 허용.

### P1-4. CSRF 방어는 SameSite=lax에만 의존
**위치:** 쿠키 `SameSite=lax` + 다수 mutating POST 라우트
**문제:** lax가 대부분의 cross-site POST를 막지만, 같은 사이트 내 변조나 lax 예외 케이스를 위해 토큰/Origin 체크가 더 견고.
**권장:** mutating 라우트에 Origin/Referer 검증 또는 CSRF 토큰(개인앱이면 Origin 체크로 충분).

### P1-5. 주문/자동매매 감사 로그(audit trail) 부재
**위치:** 거래 경로 전반 (`orders/route.ts`, `strategy-monitor.ts`, recurring)
**문제:** 거래는 `console.log`만 남고, **요청값 vs 브로커 응답을 영속 기록하는 감사 테이블이 없다.** 실계좌에선 분쟁/디버깅에 필수.
**권장:** `OrderAudit`(요청 파라미터, client_order_id, 응답 상태, 체결가, 출처[manual/strategy/recurring], 시각) 테이블 추가.

### P1-6. 긴급 정지(kill switch) 부재
**문제:** 자동매매(전략·정기투자)를 한 번에 멈추고 미체결 전량 취소하는 스위치가 없다.
**권장:** 전역 `TRADING_ENABLED` 플래그 + UI 토글. off면 스케줄러가 주문을 내지 않음. 봇 설계의 Panic Button과 동일 개념.

### P1-7. 에러 응답에 브로커 메시지 그대로 노출
**위치:** `src/lib/alpaca/client.ts`(throw 메시지), 각 route의 `err.message` 반환
**문제:** Alpaca 내부 메시지가 클라이언트로 전달 — 경미한 정보 노출.
**권장:** 사용자용 메시지/내부 로그 분리.

### P1-8. SQLite 단일 파일 — 백업/동시성
**문제:** 실계좌 회계 데이터가 단일 SQLite 파일(`prisma/trading.db`)에 있고 백업 전략이 안 보인다. 동시 쓰기 부하엔 약하다.
**권장:** 정기 백업(스냅샷) 자동화. 부하가 커지면 Postgres 이전 검토(봇은 이미 Postgres).

---

## 🟡 P2 — 리팩터 / 코드 품질

### P2-1. `OrderForm.tsx` 458줄 — 단일 책임 초과
**위치:** `src/components/orders/OrderForm.tsx` (최대 파일)
**권장:** 주문 타입 선택 / 수량·금액 입력 / 검증 / 제출을 훅(`useOrderForm`)과 하위 컴포넌트로 분리. 테스트 가능한 검증 로직은 `lib`로.

### P2-2. API 라우트 입력 검증 패턴 불일치
**위치:** 37개 라우트 중 zod 사용 0 (env만 zod)
**권장:** 공용 `validate(schema)` 헬퍼로 본문 검증을 표준화(우선순위는 거래·쓰기 라우트부터).

### P2-3. 거래 핵심 경로 테스트 공백
**위치:** `__tests__/lib/`에 recurring·strategy-monitor·alert 테스트는 있으나 **주문 라우트/금액 한도/idempotency 테스트 없음**
**권장:** P0 수정과 함께 TDD로 주문 검증·중복방지·트랜잭션 테스트 추가.

### P2-4. 페이퍼/라이브 모드 UI 표식 없음
**권장:** 현재 거래 모드(paper/live)를 TopBar/설정에 배지로 상시 노출 — 실계좌 오인 방지(P0-2와 연결).

### P2-5. 빌드/타입 위생
**위치:** `apps/mobile`가 웹 tsconfig에서 제외됨, jest config 로드에 `ts-node` 필요 등 이미 정리됨. `__tests__/lib/*`에 잔존 tsc 에러가 있어 `tsc --noEmit`가 깨끗하지 않음.
**권장:** 테스트 타입 에러 정리해 `tsc --noEmit`를 CI 게이트로.

---

## 권장 처리 순서 (실계좌 로드맵)

1. **P0-2**(기본값 paper) + **P2-4**(모드 배지) — 가장 싸고 사고 예방 효과 큼
2. **P0-3**(인증 서명화 + 봇 API 토큰) — 외부 제어 차단
3. **P0-1 / P0-5**(자동매매 중복 방지 + 실행 락) — 자금 직접 위험
4. **P0-4**(주문 검증·한도·idempotency·트랜잭션·reconciliation)
5. **P1-6**(kill switch) + **P1-5**(audit log) — 운영 안전망
6. 나머지 P1 → P2

---

## 잘 되어 있는 점

- 거래/시세 클라이언트가 `buildAlpacaClient(config)`로 주입 가능하게 분리 — 테스트 용이.
- recurring은 `lastRun`을 주문 후 갱신해 중복이 방지됨(전략 모니터와 달리 안전).
- env를 zod로 검증, 봇 대시보드 신규 코드(/bot)는 TDD + 코드리뷰로 정리됨.
- 인증 미들웨어 도입으로 "아무나 접근" 문제는 1차 해결(P0-3은 그 강화).

---

# 부록 — 구체 수정 가이드 (코드 방향)

각 항목을 실제 파일 기준으로 어떻게 고칠지. 스니펫은 방향 제시용 — 적용 시 기존 패턴/타입에 맞춰 다듬는다.

## A. 거래 모드 안전화 (P0-2, P2-4) — 가장 먼저, 가장 쌈

**`src/lib/env.ts`** — 기본값을 paper로, 모드 플래그 추가:
```ts
ALPACA_TRADING_MODE: z.enum(['paper', 'live']).default('paper'),
ALPACA_BASE_URL: z.string().url().optional(),  // 기본값 제거
```
그리고 파생 값으로 base URL을 모드에서 결정(우발적 라이브 차단):
```ts
export const env = parseEnv(process.env)
export const ALPACA_BASE = env.ALPACA_TRADING_MODE === 'live'
  ? 'https://api.alpaca.markets'
  : 'https://paper-api.alpaca.markets'
// client.ts는 config.ALPACA_BASE_URL 대신 ALPACA_BASE 사용
```
**UI 배지:** TopBar에 `env.ALPACA_TRADING_MODE`를 받아 `live`면 빨강 "LIVE" 배지. 부팅 로그에도 `console.warn('TRADING MODE: LIVE')`.

## B. 인증 강화 (P0-3, P1-1, P1-2, P1-3)

**`src/lib/session.ts` (신규)** — HMAC 서명 토큰:
```ts
import { createHmac, timingSafeEqual } from 'crypto'
import { env } from './env'   // SESSION_SECRET 추가(zod 필수)

export function signSession(): string {
  const payload = `auth.${Date.now()}`
  const sig = createHmac('sha256', env.SESSION_SECRET).update(payload).digest('hex')
  return `${payload}.${sig}`
}
export function verifySession(token?: string): boolean {
  if (!token) return false
  const i = token.lastIndexOf('.')
  if (i < 0) return false
  const payload = token.slice(0, i), sig = token.slice(i + 1)
  const expected = createHmac('sha256', env.SESSION_SECRET).update(payload).digest('hex')
  try { return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) } catch { return false }
}
```
- **`middleware.ts`**: `session !== 'authenticated'` → `!verifySession(session)`. (단, 미들웨어는 Edge 런타임 — `crypto` 사용 위해 `export const runtime = 'nodejs'` 또는 검증을 가벼운 방식으로. Node 런타임 미들웨어 설정 확인 필요.)
- **`api/login/route.ts`**: 쿠키 값 `signSession()`, 옵션 `secure: process.env.NODE_ENV === 'production'`. 비밀번호 비교는 `timingSafeEqual`로. **rate limit**: 메모리 Map으로 IP당 실패 카운트(5회/분 초과 시 429).
- **오픈 리다이렉트(P1-2)**: 로그인 페이지에서 `const to = from && from.startsWith('/') && !from.startsWith('//') ? from : '/'`.
- **`/ws` 인증(P1-3)**: `server.ts`의 `upgrade` 핸들러에서 쿠키 파싱 후 `verifySession`. 실패 시 `socket.destroy()`.

**봇 API 토큰(P0-3):** `tradingbot/api/main.py`에 의존성으로 헤더 검사 추가:
```python
BOT_API_TOKEN = os.getenv("BOT_API_TOKEN", "")
def require_token(authorization: str = Header(default="")):
    if not BOT_API_TOKEN or authorization != f"Bearer {BOT_API_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")
# 각 라우트에 dependencies=[Depends(require_token)]
```
프론트는 **Next 서버 라우트(프록시)**에서만 봇 API를 호출해 토큰을 브라우저에 노출하지 않는다. 즉 `bot-api.ts`의 직접 fetch를 `/api/bot/*` 프록시로 바꾸고 토큰은 서버 env에만 둔다. (현재 `NEXT_PUBLIC_BOT_API_URL` 직접 호출 구조를 서버 프록시로 전환 — 보안상 권장.)

## C. 자동매매 중복 방지 + 실행 락 (P0-1, P0-5)

**실행 락(P0-5)** — `server.ts` 스케줄러 재진입 차단:
```ts
let strategyRunning = false
setInterval(async () => {
  if (strategyRunning) return
  strategyRunning = true
  try { await checkStrategies() } catch (e) { console.error(e) }
  finally { strategyRunning = false }
}, 30_000)
```
(recurring/alerts도 동일 패턴)

**중복 주문 방지(P0-1)** — `strategy-monitor.ts`를 "주문 제출 기준"으로:
1. 룰 실행 전 **해당 lot의 미체결 주문 확인**: `alpaca.getOrders({ status: 'open' })`에 이 ticker가 있으면 skip.
2. 주문에 **`client_order_id`**(예: `strategy-${lot.id}-${rule.id}`) 부여 → Alpaca가 중복 거부.
3. 체결 여부와 무관하게 **제출 즉시 `soldQuantity`를 예약 증가**(낙관적). 취소/거부 시 reconciliation에서 되돌림.
4. **장중에만 실행**: `alpaca.getClock()`로 `is_open` 확인 후 진행.

## D. 주문 검증·한도·원자성 (P0-4)

**`src/lib/order-schema.ts` (신규)** — zod:
```ts
import { z } from 'zod'
export const MAX_ORDER_USD = 5000  // 단일 주문 상한(환경변수화 권장)
export const orderSchema = z.object({
  ticker: z.string().regex(/^[A-Z.]{1,6}$/i),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit']),
  qty: z.number().positive().optional(),
  notional: z.number().positive().max(MAX_ORDER_USD).optional(),
  limitPrice: z.number().positive().optional(),
  extendedHours: z.boolean().optional(),
  lotId: z.string().optional(),
  clientOrderId: z.string().uuid(),   // idempotency
}).refine(d => d.qty || d.notional, { message: 'qty 또는 notional 필요' })
```
**`api/orders/route.ts`**:
- `const body = orderSchema.parse(await req.json())` (실패 시 400).
- `placeOrder`에 `client_order_id: body.clientOrderId` 전달(Alpaca 지원) → 더블클릭/재시도 중복 차단.
- 매도 후처리 `Promise.all` → **`prisma.$transaction([...])`** 로 원자화.
- 시장가 한도: qty 주문도 예상가 × qty가 상한 초과면 거부(견적 조회 후 검증).

**미체결 reconciliation(P0-4):** 봇처럼 trade-updates 스트림을 붙이거나, `server.ts`에 1분 폴링 잡 추가 — `getOrders({status:'closed'})`에서 새로 체결된 주문을 찾아 Lot/TaxRecord 생성(현재 동기 fill 가정 제거). `client_order_id`로 중복 생성 방지.

## E. 운영 안전망 (P1-6 kill switch, P1-5 audit)

**Kill switch(P1-6):** `Setting` 테이블 또는 env `TRADING_ENABLED`(기본 true). 모든 주문 진입점(수동/전략/정기) 최상단에서 false면 즉시 return + 로그. 설정 화면에 토글 + "전체 미체결 취소" 버튼(`getOrders open` → `cancelOrder` 루프).

**Audit log(P1-5):** prisma 모델 추가:
```prisma
model OrderAudit {
  id            String   @id @default(cuid())
  source        String   // 'manual' | 'strategy' | 'recurring'
  clientOrderId String   @unique
  request       String   // JSON 직렬화한 요청
  alpacaOrderId String?
  status        String?
  filledQty     String?
  filledPrice   String?
  error         String?
  createdAt     DateTime @default(now())
}
```
주문 직전 `request`로 1행 생성 → 응답으로 update. 분쟁/디버깅·실계좌 추적의 기준점.

## 적용 단위 제안(각 PR)

1. PR1: A(모드) — env + 배지 + 로그
2. PR2: B(인증) — session.ts + 미들웨어/로그인/ws + 봇 토큰/프록시
3. PR3: C(자동매매 락·중복) — 스케줄러 가드 + strategy-monitor 재작성 + 테스트
4. PR4: D(주문 검증) — order-schema + 라우트 + 트랜잭션 + reconciliation + 테스트
5. PR5: E(kill switch + audit) — 모델/마이그레이션 + UI 토글

각 PR은 독립적으로 배포 가능하며 1→5 순서가 위험 감소 효율이 가장 높다.
