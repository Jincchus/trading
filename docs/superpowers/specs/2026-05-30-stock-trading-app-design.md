# 해외 주식 거래 모바일 웹 앱 설계

**작성일:** 2026-05-30  
**대상 플랫폼:** 모바일 웹 (Mobile Web)  
**배포 환경:** 개인 PC 서버 (자체 호스팅)

---

## 1. 프로젝트 개요

### 목적
해외 주식(미국 NYSE/NASDAQ) 실거래가 가능한 개인용 모바일 웹 트레이딩 앱.  
본인 단독 사용이 기본이며, 지인에게 소스 공유 시 `.env` API 키만 교체하면 누구나 동일하게 사용 가능하도록 설계한다.

### 핵심 요구사항
- 프리마켓 / 정규장 / 애프터마켓 전 시간대 거래
- 소수점 거래 지원
- 낮은 수수료
- 향후 Python 자동매매봇 연동 (별도 프로젝트, 상태만 표시)
- 향후 국내 주식 / 암호화폐 확장 가능한 구조

---

## 2. 시스템 아키텍처

```
[사용자 브라우저 (Mobile Web)]
        ↕ HTTPS / WebSocket
[개인 PC 서버 — Next.js App]
  ├── Pages / UI (React Components)
  ├── API Routes (BFF: API 키 보호 및 프록시)
  └── WS Server (실시간 시세, 체결, 봇 상태)
        ↕ REST + WebSocket          ↕ HTTP (봇 상태)
  [Alpaca API]               [Python 자동매매봇] ← 별도 프로젝트
        ↕
  [외부 데이터 소스]
  ├── Financial Modeling Prep / Polygon.io (배당, 테마)
  ├── TradingView Lightweight Charts (차트 렌더링)
  ├── ExchangeRate-API (실시간 환율)
  └── Web Push API (목표가·체결 알림)
```

### 설계 원칙
- Next.js API Routes가 BFF(Backend for Frontend) 역할 — API 키는 서버에서만 사용
- WebSocket으로 실시간 시세 및 체결 알림 수신
- Python 봇은 완전히 별도 프로세스, HTTP로 상태만 수신하여 표시
- `.env` 파일 하나로 모든 API 키 관리

---

## 3. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) + TypeScript |
| 스타일링 | Tailwind CSS |
| 상태 관리 | Zustand |
| 데이터 패칭 | TanStack Query (React Query) |
| 차트 | TradingView Lightweight Charts |
| 데이터베이스 | SQLite (Prisma ORM) — 개인 서버 파일 기반 |
| 실시간 | WebSocket (Next.js 커스텀 서버) |
| 알림 | Web Push API |
| 파일 파싱 | papaparse (Wise CSV), xlsx (Excel 출력) |
| 배포 | 개인 PC 서버, Node.js 직접 실행 (`next start`) |

---

## 4. 증권사 API

**Alpaca Markets** (`api.alpaca.markets`)

| 기능 | 지원 여부 |
|------|-----------|
| 미국 주식 거래 | ✅ |
| 프리/정규/애프터마켓 | ✅ |
| 소수점 거래 (Fractional Shares) | ✅ |
| 수수료 | ✅ 무료 (commission-free) |
| 실시간 시세 WebSocket | ✅ |
| 계좌 잔고 / 포지션 조회 | ✅ |
| 주문 (시장가/지정가/예약) | ✅ |
| 정기 자동 투자 | ✅ (서버 Cron Job으로 주기적 시장가 주문 실행) |
| Lot 단위 추적 | ❌ → 앱 DB에서 직접 관리 |

---

## 5. 화면 구성 (8페이지)

### 5-1. 홈 / 대시보드
- 총 자산 (USD + KRW 환산)
- 오늘 수익률 / 전체 수익률
- 보유 종목 요약 카드
- 환차익/손실 현황
- 봇 상태 패널 (Python 봇 연동 후 활성화)

### 5-2. 포트폴리오
- **전체 보기 / 카테고리별 보기** 탭 전환
- 종목별 수익률
- **Lot별 수익률** — 취득일, 취득가, 수량, 현재가, 손익 표시
- 복수 카테고리 종목은 태그 형태로 표시 (예: `AI` `반도체`)
- 비중 차트 (파이)
- 수익률 분석 (기간별: 1주/1달/3달/1년)
- 월별 투자 리포트

### 5-3. 종목 탐색
- 종목 검색 (티커 / 회사명)
- 인기 종목 랭킹 (거래량 기준)
- 테마별 종목 묶음 (외부 API 데이터)
- 관심종목 (워치리스트) 그룹 관리

### 5-4. 종목 상세
- 실시간 시세 + 호가창
- 차트 — 기간(1일/1주/1달/1년/전체), 기술적 지표(이동평균선, 볼린저밴드 등), 거래량
- 배당금 현황 및 예정일
- 매수/매도 주문 패널 (해당 페이지에서 바로 주문)

### 5-5. 주문
- 주문 유형: 시장가 / 지정가 / 예약 주문
- 소수점 거래 지원
- **매도 시 Lot 선택** — 어떤 Lot을 팔지 직접 선택
- 정기 자동 투자 설정 (주기, 금액)
- 주문 내역 (체결 / 미체결 / 취소)
- 미체결 주문 관리 (취소 가능)

### 5-6. 자산 관리

#### 환전 추적
- **Wise CSV 업로드** — Wise 거래내역 파일 파싱, KRW→USD 환전 항목 자동 추출
- 수동 환전 기록 추가 (은행 등 Wise 외 방법 사용 시)
- 환전 이력: 날짜, 원화 금액, 당시 환율, 수령 달러
- **환차익/손실 계산**: 현재 환율 기준 KRW 환산가 vs 원래 투입 원화

#### 배당금
- 배당금 수령 내역 (Alpaca 데이터)

#### 세금
- **해외주식 양도소득세 가이드**
  - 연간 250만원 기본공제, 초과분 22%
  - 신고 기간: 매년 5월 (종합소득세 신고)
  - 홈택스 신고 단계별 안내
- **세금 신고용 Excel 다운로드**
  - Lot별 취득일, 취득가(USD), 취득환율, 취득가(KRW)
  - 양도일, 양도가(USD), 양도환율, 양도가(KRW), 양도차익(KRW)
  - 합계: 총 양도차익, 기본공제, 과세표준, 납부세액(22%)

### 5-7. 알림
- 목표가 알림 설정 (종목별 목표 가격 지정)
- 체결 알림
- 전략 자동 실행 알림 (어떤 Lot에서 몇 주 자동 매도됐는지)
- 알림 내역

### 5-8. 설정
- API 키 설정 (Alpaca, 외부 데이터 API)
- **카테고리 관리** — 생성·수정·삭제 (배당주, 성장주, AI 등 자유 설정)
- **매매 전략 관리** — 룰 기반 자동 매도 전략 생성
- 알림 설정 (Web Push 권한)
- 기본 통화 표시 (USD / KRW 우선)
- 셋업 가이드 (지인 공유용 API 키 발급 안내)

---

## 6. 핵심 기능 상세 설계

### 6-1. Lot 추적 시스템

Alpaca는 포지션 총량만 제공하므로 Lot 단위 추적은 앱 DB에서 관리한다.

**Lot 데이터 구조:**
```
Lot {
  id
  ticker          // 종목 티커 (AAPL 등)
  quantity        // 원래 lot 수량 (소수 가능)
  purchase_price  // 취득가 (USD)
  purchase_date   // 취득일
  alpaca_order_id // Alpaca 주문 ID (체결 확인용)
  strategy_id     // 적용된 전략 (nullable)
  sold_quantity   // 이 lot에서 지금까지 매도된 수량
  status          // active / fully_sold
}
```

**매도 시 동작:**
1. 사용자가 매도할 Lot 선택
2. 해당 Lot의 수량만큼 Alpaca에 매도 주문
3. 체결 후 `sold_quantity` 업데이트
4. 세금 기록용 양도 내역 자동 저장

### 6-2. 사용자 정의 카테고리

- 카테고리와 종목은 **다대다(M:N)** 관계
- 하나의 종목이 여러 카테고리에 속할 수 있음
- 포트폴리오 카테고리별 보기에서 중복 종목은 태그로 명시
- 카테고리 합산 수익률 표시 시 중복 종목 안내 문구 포함

**데이터 구조:**
```
Category { id, name, color }
StockCategory { ticker, category_id }  // 중간 테이블
```

### 6-3. 룰 기반 자동 매도 전략

**전략 구조:**
```
Strategy {
  id
  name            // 예: "성장주 전략"
  rules: [
    { threshold: +20, sell_pct: 30 },  // +20% 수익 시 원래 lot의 30% 매도
    { threshold: +50, sell_pct: 50 },  // +50% 수익 시 원래 lot의 50% 매도 (이미 팔린 것 차감)
    { threshold: +70, sell_pct: 100 }, // +70% 수익 시 잔여 전량 매도
    { threshold: -15, sell_pct: 100 }, // -15% 손실 시 전량 손절
  ]
}
```

**매도 수량 계산 (원래 Lot 기준):**
```
목표 누적 매도량 = 원래 수량 × 규칙의 sell_pct%
실제 이번 매도량 = 목표 누적 매도량 - 이미 매도된 수량(sold_quantity)
```

**실행 흐름:**
1. Next.js 서버 백그라운드 Job이 WebSocket 실시간 가격으로 Lot별 수익률 계산
2. 전략 규칙 조건 충족 시 Alpaca 매도 주문 자동 실행
3. 체결 후 Lot의 `sold_quantity` 업데이트
4. 사용자에게 Web Push 알림 발송

**복수 임계값 동시 통과 처리:**  
가격이 한 번에 +5% → +60%로 급등 시 (예: 갭 상승), +20%, +50% 규칙이 모두 순서대로 실행된다.  
각 규칙의 `실제 이번 매도량` 계산이 누적 기반이므로 중복 매도 없이 올바르게 처리된다.

### 6-4. 환차익/손실 추적

**환전 기록 데이터 구조:**
```
FxRecord {
  id
  date            // 환전일
  krw_amount      // 원화 금액
  exchange_rate   // 당시 환율 (KRW/USD)
  usd_amount      // 수령 달러
  source          // "wise" | "bank" | "manual"
}
```

**Wise CSV 파싱:**
- Wise 내보내기 파일에서 `type = CONVERSION`, `sourceCurrency = KRW`, `targetCurrency = USD` 항목 필터링
- 중복 방지: 동일 날짜+금액 기록은 재업로드 시 무시

**환차익 계산:**
```
총 투입 원화 = Σ FxRecord.krw_amount
현재 KRW 환산가 = Alpaca 총 USD 자산 × 현재 환율
환차익/손실 = 현재 KRW 환산가 - 총 투입 원화
```

---

## 7. 데이터베이스 구조 (SQLite)

```
Lot              // Lot 추적
Category         // 사용자 정의 카테고리
StockCategory    // 종목-카테고리 다대다
Strategy         // 자동 매도 전략
StrategyRule     // 전략별 규칙
LotStrategy      // Lot에 적용된 전략
FxRecord         // 환전 기록
TaxRecord        // 양도 내역 (세금 계산용)
Alert            // 목표가 알림 설정
AlertHistory     // 알림 발송 내역
```

---

## 8. 외부 API 목록

| API | 용도 | 비용 |
|-----|------|------|
| Alpaca Markets | 거래 실행, 실시간 시세, 계좌 정보 | 무료 |
| Financial Modeling Prep | 배당 데이터, 테마 종목 | 무료 플랜 있음 |
| ExchangeRate-API | KRW/USD 실시간 환율 | 무료 플랜 있음 |
| TradingView Lightweight Charts | 차트 렌더링 | 무료 (오픈소스) |
| Web Push API | 브라우저 알림 | 무료 |

---

## 9. 환경 설정 (.env)

```env
# Alpaca
ALPACA_API_KEY=
ALPACA_API_SECRET=
ALPACA_BASE_URL=https://api.alpaca.markets

# 외부 데이터
FMP_API_KEY=           # Financial Modeling Prep
EXCHANGE_RATE_API_KEY= # ExchangeRate-API

# 서버
PORT=3000
```

지인 공유 시: 위 키만 교체 후 `npm install && npm run build && npm start`

**접근 제어:**  
개인 서버에서만 사용하는 경우 별도 로그인 없이 사용 가능.  
외부 접근이 필요한 경우 nginx/Caddy로 Basic Auth 또는 IP 화이트리스트로 보호 권장.

**Web Push 알림 주의사항:**  
Web Push API는 HTTPS 환경에서만 동작한다.  
외부에서 접근 시 Let's Encrypt + Caddy로 SSL 설정이 필요하다.  
로컬(localhost)에서만 사용하는 경우 HTTP에서도 동작한다.

---

## 10. 향후 확장 계획

| 단계 | 내용 |
|------|------|
| Phase 2 | Python 자동매매봇 개발 및 연동 (봇 상태 패널 활성화) |
| Phase 3 | 국내 주식 (KRX) 추가 — 별도 증권사 API 연동 |
| Phase 4 | 암호화폐 추가 |
