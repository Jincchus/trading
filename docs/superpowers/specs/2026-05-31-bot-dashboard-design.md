# Bot Dashboard 설계 문서

**날짜:** 2026-05-31
**목표:** 기존 trading-stock-trading Next.js 앱에 `/bot` 페이지를 추가해 트레이딩봇 전략별 성과를 한눈에 비교하고 상세 조회

---

## 1. 라우팅

| 경로 | 설명 |
|------|------|
| `/bot` | 봇 대시보드 (단일 페이지, 모든 정보 포함) |

- 기존 `BottomNav`에 "봇" 항목 추가 (아이콘: `Bot` from lucide-react)
- 서브 라우트 없음 — 전략 전환은 탭, 섹션 전환은 서브탭으로 처리
- 봇 API URL은 Next.js `.env.local`의 `NEXT_PUBLIC_BOT_API_URL` 환경변수로 관리 (기본값: `http://localhost:8000`)
- **전략 start/stop 제어 포함** — 각 전략 탭에서 시작/정지 가능 (POST /start·/stop 연동)

---

## 2. 페이지 구조

```
TopBar: "봇 대시보드"  + 우측 새로고침 버튼(RefreshCw 아이콘, 회전 애니메이션)

[A] 누적 수익률 비교차트 (상단 고정 섹션)
    - 전략 전체 오버레이 라인차트 (lightweight-charts LineSeries)
    - 7일 / 30일 / 전체 기간 토글 버튼
    - 범례: 전략명 + 누적 수익률 (예: v1 +2.4%)
    - 데이터: GET /strategies/{id}/portfolio 의 equity 시계열 → strategies.budget 대비 % 변환 (budget은 /strategies 응답에 포함)
    - x축 정렬: 각 전략 portfolio_history의 timestamp를 그대로 사용(전략별 등록 시점이 달라 시작점이 다름). lightweight-charts는 시리즈별 독립 시간축을 허용하므로 각 LineSeries에 자기 timestamp 그대로 setData. 빈 구간은 보간하지 않음
    - 기간 토글(7일/30일/전체)은 클라이언트에서 timestamp 필터링

[B] 전략 탭
    - 전략 목록(GET /strategies) 기반으로 탭 동적 생성
    - 탭 레이블: strategies.name의 마지막 단어 (예: "MA 크로스오버 v1" → "v1"). 전략명 마지막 단어가 없으면 id 사용
    - 상태 표시: running(초록) / stopped(회색) / failed(빨강)

[C] 탭 내부 (선택된 전략)

  [C-1] 아코디언 (전략 정보 카드)
      - 기본: 전략명 + 상태 배지 + start/stop 버튼 + 화살표(›)
        - status=running → "정지" 버튼(빨강), status=stopped/failed → "시작" 버튼(초록)
        - 버튼 클릭은 아코디언 토글과 분리 (stopPropagation)
      - 클릭 시 펼침: 전략 설명 텍스트 · 주기(run_interval) · 예산(budget) · 감시 종목 배지
      - 전략 설명 · 종목 목록은 strategy_type 기반 프론트엔드 하드코딩 맵으로 표시
        - `ma_crossover` → 설명: "단기(10)·장기(30) 이동평균 크로스오버 전략. 골든크로스 매수, 데드크로스 청산" / 종목: AAPL·MSFT·NVDA·TSLA·GOOGL
        - 알 수 없는 타입은 strategy_type 문자열 그대로 표시
      - 왼쪽 border-left: 전략 색상 (v1=초록, v2=파랑, v3=노랑, v4=빨강)

  [C-2] 자산 요약 카드
      - 총 자산(equity) · 손익 금액 · 손익 % (예산 대비)
      - 자산 라인차트: portfolio_history.equity 시계열 (lightweight-charts)
      - 데이터: GET /strategies/{id}/portfolio

  [C-3] 서브탭: 개요 · 포지션 · 체결

    [개요]
      - 2×2 지표 그리드: 오늘 수익률 · 승률 · Sharpe · MDD
      - 데이터: GET /strategies/{id}/performance (최신 1개)
      - 지표 없을 때(데이터 미축적): "장 마감 후 집계됩니다" 안내 문구

    [포지션]
      - 종목 카드 리스트: 종목명 · 보유수량 · 평균단가 · 평가손익(금액+%)
      - 포지션 없을 때: "보유 포지션 없음" 빈 상태
      - 데이터: GET /strategies/{id}/positions (신규 엔드포인트)

    [체결]
      - 체결 내역 전체 리스트 (최신순)
      - 항목: BUY/SELL 배지 · 종목 · 수량 · 체결가 · 날짜
      - 체결 없을 때: "체결 내역 없음" 빈 상태
      - 데이터: GET /strategies/{id}/trades
```

---

## 3. 신규 API 엔드포인트 (봇 서버)

### GET /strategies/{id}/positions

Alpaca `get_all_positions()`를 on-demand 호출해 현재 보유 포지션 반환.

**응답 스키마:**
```json
[
  {
    "symbol": "AAPL",
    "qty": "10",
    "avg_entry_price": "182.50",
    "current_price": "190.00",
    "unrealized_pl": "75.00",
    "unrealized_plpc": "0.0411"
  }
]
```

**구현 위치:**
- `api/schemas.py` — `PositionResponse` Pydantic 모델 추가
- `api/main.py` — `GET /strategies/{id}/positions` 엔드포인트 추가
  - DB에서 전략 키 조회 → `TradingClient(key, secret).get_all_positions()` 호출
  - 전략 없으면 404, Alpaca 오류 시 502

---

## 4. 데이터 흐름

```
/bot 페이지 마운트
  → GET /strategies              전략 탭 목록 렌더링
  → GET /strategies/*/portfolio  비교차트 데이터 (전략 수만큼 병렬)

전략 탭 클릭
  → GET /strategies/{id}/portfolio   자산 라인차트
  → GET /strategies/{id}/performance 개요 지표 (서브탭 기본값)

서브탭 전환
  → 포지션: GET /strategies/{id}/positions
  → 체결:   GET /strategies/{id}/trades

start/stop 버튼 클릭
  → 확인 다이얼로그 → POST /strategies/{id}/start | /stop
  → 성공 시 GET /strategies 재요청으로 상태 배지 갱신 (낙관적 업데이트 X, 서버 확정값 반영)
```

### 전략 제어 (start/stop)

- 각 전략 아코디언 헤더의 버튼에서 호출
- **확인 다이얼로그 필수** — "v1 전략을 정지할까요?" / "시작할까요?" (실수 방지)
- 호출 중 버튼 비활성화 + 로딩 표시. 응답(2xx) 후 `GET /strategies` 재요청으로 실제 상태 반영
- 실패 시 토스트/인라인 에러 ("전략 시작 실패") + 상태 원복
- start 직후 status는 즉시 running이 되지만 실제 시세 수신·체결까지는 시간이 걸림 (안내 불필요, 폴링이 자연 반영)

---

## 5. 컴포넌트 구조

```
src/app/bot/
└── page.tsx                     # /bot 페이지

src/components/bot/
├── ComparisonChart.tsx           # 누적 수익률 오버레이 차트
├── StrategyAccordion.tsx         # 아코디언 전략 설명 카드 + start/stop 버튼
├── AssetCard.tsx                 # 자산 요약 + 라인차트
├── OverviewTab.tsx               # 서브탭: 개요 (지표 4개)
├── PositionsTab.tsx              # 서브탭: 포지션 리스트
└── TradesTab.tsx                 # 서브탭: 체결 내역

src/lib/
├── bot-api.ts                    # 봇 API fetch 래퍼 (BASE URL + 엔드포인트 함수들)
└── bot-format.ts                 # 통화·퍼센트·KST 시각 포맷 헬퍼
```

확인 다이얼로그는 기존 앱에 공용 모달이 있으면 재사용, 없으면 `window.confirm` 또는 간단한 인라인 확인으로 처리 (구현 시 기존 패턴 확인).

---

## 6. 스타일 가이드

기존 앱 패턴 그대로 준수:
- 배경: `bg-gray-950` (페이지), `bg-gray-900` (카드)
- 텍스트: `text-white` (primary), `text-gray-400` (secondary)
- 활성 탭: `border-b-2 border-blue-500 text-white`
- 수익 양수: `text-emerald-400`, 음수: `text-red-400`
- 차트: `lightweight-charts` (기존 StockChart와 동일 라이브러리)
- 전략별 고정 색상: v1=`#34d399`, v2=`#60a5fa`, v3=`#fbbf24`, v4=`#f87171`

---

## 7. CORS

봇 API(`localhost:8000`)를 브라우저에서 직접 호출 — Next.js API Route proxy 없이 직접 fetch.
봇 서버 `.env`의 `CORS_ORIGINS`에 trading 앱 origin이 이미 등록돼 있어야 함.

현재 `CORS_ORIGINS=http://localhost:3000` — trading 앱이 `localhost:3000`이면 OK.
서버 배포 환경에서는 실제 도메인/포트로 변경 필요.

---

## 8. 빈 상태 / 로딩 처리

| 상황 | 표시 |
|------|------|
| 전략 없음 | "등록된 전략이 없습니다" |
| 성과 데이터 미축적 | "장 마감 후 집계됩니다" |
| 포지션 없음 | "현재 보유 포지션 없음" |
| 체결 없음 | "체결 내역 없음" |
| API 오류 | "데이터를 불러올 수 없습니다" (빨간 텍스트) |
| 로딩 중 (최초) | 기존 앱 패턴인 `animate-pulse bg-gray-800 rounded-xl` 스켈레톤 블록 |

- 폴링에 의한 재요청 시에는 스켈레톤을 다시 띄우지 않음 (깜빡임 방지) — 기존 데이터 유지하며 백그라운드 갱신

---

## 9. 데이터 갱신 & 인터랙션

**자동 폴링 + 수동 새로고침 버튼** 방식.

- **자동 폴링**: 페이지 마운트 동안 **30초**마다 현재 보이는 데이터 재요청
  - 갱신 대상: 전략 목록(상태), 선택된 전략의 자산/개요/포지션/체결, 비교차트
  - `setInterval` + cleanup, 탭이 백그라운드일 때는 `document.visibilityState`로 일시정지(불필요한 호출 방지)
- **수동 버튼**: TopBar 우측 `RefreshCw` 아이콘. 클릭 시 즉시 전체 재요청 + 아이콘 회전 애니메이션, 완료 시 정지
- **차트 갱신**: 폴링 시 차트를 재생성하지 않고 `series.setData(newData)`로 데이터만 교체 (깜빡임 방지). 차트 인스턴스는 `useRef`로 유지
- **요청 정책**: 비교차트용 `portfolio` N개 호출은 `Promise.all` 병렬. 폴링 주기 내 이전 요청이 안 끝났으면 스킵(중첩 방지)

---

## 10. 포맷 규칙

- **통화**: USD 기준. `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` → `$10,240.00`
- **수익률/퍼센트**: 소수 2자리 + 부호 (`+2.40%`, `-1.50%`)
- **시각**: Alpaca 응답은 UTC/ET 기준 → **KST로 변환 표시** (`toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })`). 체결 시각은 `MM/DD HH:mm` 형식
- **손익 색상**: 양수 `text-emerald-400`, 음수 `text-red-400`, 0 또는 null `text-gray-400`
- 기존 앱은 `.toLocaleString('en-US', { style: 'currency', currency: 'USD' })`를 인라인으로 사용(공용 포맷 lib 없음). 봇 대시보드는 반복되는 포맷(통화·퍼센트·KST 시각)을 `src/lib/bot-format.ts` 작은 헬퍼로 모아 봇 컴포넌트끼리 공유
