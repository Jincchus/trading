# 설계: 봇 제어 UI (감시 종목·포지션 크기·비상 청산)

작성일: 2026-06-02
프로젝트: `stock-trading-app` (Next.js, `/home/server/trading`)

## 배경 / 목적

봇 백엔드(`tradingbot`)에 2026-06-02 추가된 런타임 제어 API를 웹 대시보드에서 쓸 수 있게 한다:
- 감시 종목(4개 봇 공통) 조회·변경
- 봇별 포지션 크기(%) 변경
- 비상 수동 청산(종목 1개 / 봇 전체 / 전체)

현재 봇 대시보드(`src/app/bot/page.tsx`)는 전략 목록·비교차트·포지션·체결만 보여주고, 종목은 `StrategyAccordion.tsx`에 하드코딩(`COMMON_SYMBOLS`)돼 있다. 이를 실제 API에 연결한다.

## 백엔드 API (이미 구현됨, 참고)

- `GET /watchlist` → `{ "symbols": ["AAPL", ...] }`
- `PUT /watchlist` body `{ "symbols": [...] }` → 검증(잘못된 종목 시 400 + `detail` 메시지), 빠진 종목 자동청산, 돌던 봇 자동 재시작
- `PATCH /strategies/{id}` body `{ "position_size": 0.1 }` → 봇별 비중 변경(범위 (0,1], 위반 시 400). `StrategyResponse` 반환(이제 `position_size` 포함)
- `POST /strategies/{id}/positions/{symbol}/close` → 종목 1개 청산 + 그 봇 정지
- `POST /strategies/{id}/liquidate` → 봇 전체 청산 + 정지
- `POST /liquidate-all` → 모든 봇 청산 + 정지

호출은 모두 기존 프록시 `/api/bot/[...path]`를 거친다(서버에서 Bearer 토큰 주입).

## 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 감시 종목 편집 위치 | 봇 대시보드 맨 위 "감시 종목" 카드 |
| 종목 편집 방식 | 칩(chip) 방식 — 칩 표시 + 입력 추가 + ✕ 삭제 + 저장 |
| 포지션 크기(%) 편집 위치 | 전략 아코디언 펼친 영역 인라인 |
| 비상 청산 UI | 3종 모두: 전체(상단 빨간 버튼), 봇별(아코디언), 종목1개(포지션 탭) |

## 아키텍처

### 1. 통신 배관

**`src/app/api/bot/[...path]/route.ts`** — `PUT`, `PATCH` 핸들러 추가. 기존 `proxy()`를 재사용(이미 body 전달·토큰 주입 지원). 추가 코드는 GET/POST와 동형:
```ts
export async function PUT(req, { params }) { return proxy(req, await params, 'PUT') }
export async function PATCH(req, { params }) { return proxy(req, await params, 'PATCH') }
```

**`src/lib/bot-api.ts`** — 추가:
- 헬퍼 `put<T>(path, body)`, `patch<T>(path, body)` (JSON body, `!res.ok`면 응답 `detail`을 포함한 에러 throw — 검증 메시지 노출용)
- 타입: `Strategy`에 `position_size: string` 추가. 신규 `Watchlist { symbols: string[] }`
- 함수: `getWatchlist()`, `updateWatchlist(symbols: string[])`, `patchStrategy(id, position_size: number)`, `closePosition(id, symbol)`, `liquidateStrategy(id)`, `liquidateAll()`

기존 `get`/`post`는 에러 시 `detail`을 버린다. 신규 `put`/`patch`는 가능한 경우 `body.detail`을 에러 메시지로 실어, 화면에서 "어떤 종목이 잘못됐는지"를 보여줄 수 있게 한다.

### 2. 감시 종목 카드 — 신규 `src/components/bot/WatchlistCard.tsx`

- props: `{ symbols: string[]; onChanged: () => void }` (상위가 watchlist를 들고 내려줌)
- 로컬 편집 상태(draft) = 칩 배열. 입력칸 + "추가"(대문자 정규화, 중복/빈값 무시), 칩 ✕로 제거.
- "저장" → 빈 목록이면 막고, `window.confirm`("빠진 종목은 자동 청산되고 돌던 봇이 재시작돼요. 진행할까요?") → `updateWatchlist(draft)`.
  - 성공: `onChanged()` 호출(상위 새로고침). 실패: 에러 메시지(검증 `detail` 포함) 빨간색 표시.
- "변경됨" 상태(draft ≠ 원본)일 때만 저장 버튼 활성. 로딩 중 비활성.

### 3. 포지션 크기(%) — `StrategyAccordion.tsx` 수정

- 펼친 영역에 현재 `position_size`를 % 로 표시 + 작은 number 입력 + "변경" 버튼.
- "변경" → 0<x≤100(%) 검증 후 `patchStrategy(id, x/100)` → 성공 시 `onChanged()`.
- 안내 문구: "다음 봇 재시작부터 적용돼요".
- 하드코딩 `COMMON_SYMBOLS`/`meta.symbols` 칩을 제거하고, 상위에서 내려준 실제 watchlist를 표시(공통이므로 prop `symbols`로 전달).

### 4. 비상 청산

- **전체 비상 청산**: `bot/page.tsx` 상단(차트 위)에 빨간 "전체 비상 청산" 버튼. 클릭 → `confirm` 2회(2번째는 문구 다르게) → `liquidateAll()` → `refreshBoth()`.
- **이 봇 청산**: `StrategyAccordion` 펼친 영역에 "이 봇 청산" 버튼 → `confirm` → `liquidateStrategy(id)` → `onChanged()`.
- **종목 1개 팔기**: `PositionsTab`에 종목마다 "팔기" 버튼. 이를 위해 `PositionsTab`에 `strategyId`와 `onChanged` prop 추가, `bot/page.tsx`에서 `selectedId` 전달 → `closePosition(selectedId, symbol)` → `confirm` → `onChanged()`.
- 청산은 백엔드가 봇을 정지시키므로, 실행 후 새로고침으로 상태가 "stopped"로 반영된다.

### 5. 페이지 배선 — `src/app/bot/page.tsx`

- 상태에 `watchlist: string[]` 추가. `loadAll`에서 `getWatchlist()` 호출(실패 시 빈 배열, 카드가 처리).
- 렌더: 상단 "전체 비상 청산" 버튼 → `WatchlistCard` → 비교차트 → 전략 탭 → `StrategyAccordion`(symbols 전달) → 서브탭(PositionsTab에 strategyId/onChanged 전달).
- 모든 변경 콜백은 기존 `refreshBoth`/`onChanged=refreshBoth`로 일관 처리.

## 데이터 흐름

```
bot/page.tsx (loadAll: getStrategies + getWatchlist + portfolios)
  ├─ WatchlistCard(symbols, onChanged=refreshBoth) ──PUT /watchlist──▶ proxy ─▶ bot
  ├─ 전체 비상 청산 버튼 ──POST /liquidate-all──▶ ...
  └─ StrategyAccordion(strategy, symbols, onChanged)
        ├─ 시작/정지 (기존)
        ├─ 포지션 크기 ──PATCH /strategies/{id}──▶ ...
        └─ 이 봇 청산 ──POST /strategies/{id}/liquidate──▶ ...
     PositionsTab(positions, strategyId, onChanged)
        └─ 종목 팔기 ──POST /strategies/{id}/positions/{symbol}/close──▶ ...
```

## 에러 처리

- 모든 액션: 각 컴포넌트 로컬 `error` 상태에 메시지, 빨간 텍스트로 인라인 표시. 로딩 중 버튼 비활성.
- `PUT /watchlist` 400: 백엔드 `detail`(예: "invalid or non-tradable symbols: ['APPL']")을 그대로 노출.
- `PATCH` 범위 위반: 클라이언트에서 1차 검증(0<x≤100) + 서버 400 메시지 표시.
- 프록시 502(봇 서버 불통): "봇 서버에 연결할 수 없습니다" 표시.

## 테스트 (jest)

기존 `__tests__` 패턴을 따른다(`global.fetch` 목).
- `bot-api`: `getWatchlist`/`updateWatchlist`/`patchStrategy`/`closePosition`/`liquidateStrategy`/`liquidateAll`가 올바른 method·path·body로 fetch 호출. `put`/`patch`가 `detail`을 에러로 실어 throw.
- `WatchlistCard`: 칩 추가/삭제, 빈 목록 저장 차단, 저장 성공 시 `onChanged` 호출, 실패 시 에러 표시. (`window.confirm` 목)
- `StrategyAccordion`: 포지션 크기 변경이 `patchStrategy` 호출, "이 봇 청산"이 confirm 후 `liquidateStrategy` 호출.
- `PositionsTab`: "팔기"가 confirm 후 `closePosition(strategyId, symbol)` 호출.

## 범위 밖 (이번 제외)

- 분할 매수/물타기, 손절·익절 UI.
- 종목별 검색·자동완성(심볼 자동완성) — 일단 수동 입력.
- 전략 신규 등록/삭제 UI.
- 권한/역할 분리(기존 인증 그대로 사용).

## 주의 (커스텀 Next.js)

이 저장소는 커스텀 Next.js 빌드(AGENTS.md 경고). 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인한다(특히 route handler·app router 규약).
```
