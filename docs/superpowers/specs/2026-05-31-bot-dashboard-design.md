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

---

## 2. 페이지 구조

```
TopBar: "봇 대시보드"

[A] 누적 수익률 비교차트 (상단 고정 섹션)
    - 전략 전체 오버레이 라인차트 (lightweight-charts LineSeries)
    - 7일 / 30일 / 전체 기간 토글 버튼
    - 범례: 전략명 + 누적 수익률 (예: v1 +2.4%)
    - 데이터: GET /strategies/{id}/portfolio 의 equity 시계열 → strategies.budget 대비 % 변환 (budget은 /strategies 응답에 포함)

[B] 전략 탭
    - 전략 목록(GET /strategies) 기반으로 탭 동적 생성
    - 탭 레이블: strategies.name의 마지막 단어 (예: "MA 크로스오버 v1" → "v1"). 전략명 마지막 단어가 없으면 id 사용
    - 상태 표시: running(초록) / stopped(회색) / failed(빨강)

[C] 탭 내부 (선택된 전략)

  [C-1] 아코디언 (전략 정보 카드)
      - 기본: 전략명 + 상태 배지 + 화살표(›) 만 표시
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
```

---

## 5. 컴포넌트 구조

```
src/app/bot/
└── page.tsx                     # /bot 페이지

src/components/bot/
├── ComparisonChart.tsx           # 누적 수익률 오버레이 차트
├── StrategyAccordion.tsx         # 아코디언 전략 설명 카드
├── AssetCard.tsx                 # 자산 요약 + 라인차트
├── OverviewTab.tsx               # 서브탭: 개요 (지표 4개)
├── PositionsTab.tsx              # 서브탭: 포지션 리스트
└── TradesTab.tsx                 # 서브탭: 체결 내역
```

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

## 8. 빈 상태 처리

| 상황 | 표시 |
|------|------|
| 전략 없음 | "등록된 전략이 없습니다" |
| 성과 데이터 미축적 | "장 마감 후 집계됩니다" |
| 포지션 없음 | "현재 보유 포지션 없음" |
| 체결 없음 | "체결 내역 없음" |
| API 오류 | "데이터를 불러올 수 없습니다" (빨간 텍스트) |
