# Web Push (VAPID) 설정 + Service Worker + Env 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹 푸시 알림 기능을 위한 VAPID 설정, Service Worker, 환경변수 검증 확장

**Architecture:** web-push 패키지 설치 → VAPID 키 생성 및 환경변수 설정 → env.ts 스키마 확장 → jest.setup.ts 테스트 환경 설정 → Service Worker 구현 → 전체 테스트 실행 및 커밋

**Tech Stack:** web-push, Next.js Service Worker, Zod 환경변수 검증

---

### Task 1: web-push 패키지 설치

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (자동 생성)

- [ ] **Step 1: web-push 패키지 설치**

```bash
npm install web-push
npm install --save-dev @types/web-push
```

Expected: package.json과 package-lock.json에 web-push 의존성 추가됨

- [ ] **Step 2: VAPID 키 생성**

```bash
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log('PUBLIC:', k.publicKey, '\nPRIVATE:', k.privateKey)"
```

출력 예:
```
PUBLIC: BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
PRIVATE: UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSkFU
```

생성된 키를 메모해두기 (다음 Task에서 사용)

---

### Task 2: .env 파일에 VAPID 설정 추가

**Files:**
- Modify: `.env`

- [ ] **Step 1: .env 파일 내용 확인**

현재 .env 파일을 읽고 마지막 라인 확인

- [ ] **Step 2: VAPID 환경변수 추가**

.env 파일 하단에 다음 내용 추가 (Task 1에서 생성한 키 값 사용):

```env
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
VAPID_PRIVATE_KEY=UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSkFU
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
VAPID_EMAIL=admin@example.com
```

---

### Task 3: .env.example에 VAPID 설정 추가

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: .env.example 현재 내용 확인**

파일 끝 부분 확인

- [ ] **Step 2: VAPID 주석 및 템플릿 추가**

.env.example 파일 하단에 다음 내용 추가:

```env

# Web Push (VAPID) — generate keys: node -e "require('web-push').generateVAPIDKeys()" | jq
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_EMAIL=admin@example.com
```

---

### Task 4: src/lib/env.ts 스키마 확장

**Files:**
- Modify: `src/lib/env.ts`

- [ ] **Step 1: 현재 env.ts 파일 확인**

11번 라인의 EXCHANGE_RATE_API_KEY 이후에 추가할 위치 확인

- [ ] **Step 2: schema에 VAPID 필드 추가**

src/lib/env.ts의 schema 객체에 다음 필드를 추가 (EXCHANGE_RATE_API_KEY 아래):

```typescript
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  ALPACA_API_KEY: z.string().min(1),
  ALPACA_API_SECRET: z.string().min(1),
  ALPACA_BASE_URL: z.string().url().default('https://api.alpaca.markets'),
  ALPACA_WS_URL: z.string().url().default('wss://stream.data.alpaca.markets/v2/iex'),
  ALPACA_DATA_URL: z.string().url().default('https://data.alpaca.markets'),
  FMP_API_KEY: z.string().min(1),
  EXCHANGE_RATE_API_KEY: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_EMAIL: z.string().default('admin@example.com'),
  PORT: z.string().default('3000'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors)}`)
  }
  return result.data
}

export const env = parseEnv(process.env)
```

- [ ] **Step 3: 파일 저장 확인**

파일이 정상적으로 저장되었는지 확인

---

### Task 5: jest.setup.ts에 VAPID 테스트 환경 추가

**Files:**
- Modify: `jest.setup.ts`

- [ ] **Step 1: 현재 jest.setup.ts 확인**

파일의 마지막 라인 확인

- [ ] **Step 2: VAPID 환경변수 추가**

jest.setup.ts의 마지막에 다음 내용 추가:

```typescript
process.env.VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
process.env.VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSkFU'
process.env.VAPID_EMAIL = 'admin@example.com'
```

---

### Task 6: public/sw.js Service Worker 작성

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: public 디렉토리 확인**

public 디렉토리가 존재하는지 확인. 없으면 생성.

- [ ] **Step 2: Service Worker 파일 생성**

`public/sw.js` 파일을 다음 내용으로 생성:

```javascript
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

- [ ] **Step 3: 파일 저장 확인**

`public/sw.js` 파일이 정상적으로 생성되었는지 확인

---

### Task 7: 전체 테스트 실행 및 검증

**Files:**
- Test: 모든 테스트 파일

- [ ] **Step 1: 전체 테스트 실행**

```bash
npx jest
```

Expected: 81개 테스트 모두 PASS

- [ ] **Step 2: 테스트 결과 확인**

출력에서 다음 패턴 확인:
```
Test Suites: X passed, X total
Tests:       81 passed, 81 total
```

테스트가 실패하면 에러 메시지 확인 및 수정

---

### Task 8: Git 커밋

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `public/sw.js`
- Modify: `src/lib/env.ts`
- Modify: `jest.setup.ts`
- Modify: `.env.example`

- [ ] **Step 1: 변경사항 확인**

```bash
git status
```

다음 파일들이 수정/생성되었는지 확인:
- package.json
- package-lock.json
- public/sw.js (새로 생성)
- src/lib/env.ts
- jest.setup.ts
- .env.example

- [ ] **Step 2: 스테이징 및 커밋**

```bash
git add package.json package-lock.json public/sw.js src/lib/env.ts jest.setup.ts .env.example
git commit -m "Feat: add VAPID config, service worker, and env extensions for Web Push"
```

- [ ] **Step 3: 커밋 해시 확인**

```bash
git log -1 --oneline
```

출력된 커밋 해시 메모 (최종 보고에 포함)

---

## 검증 체크리스트

- [ ] web-push 패키지 설치 완료
- [ ] VAPID 키 생성 및 모든 env 파일에 설정 완료
- [ ] env.ts 스키마에 VAPID 필드 추가 완료
- [ ] jest.setup.ts에 테스트 환경 변수 추가 완료
- [ ] public/sw.js Service Worker 파일 생성 완료
- [ ] 전체 테스트 81개 PASS 확인
- [ ] Git 커밋 완료
