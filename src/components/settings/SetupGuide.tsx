'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const STEPS = [
  {
    title: '1. Alpaca Markets 계정 생성',
    content: [
      'https://app.alpaca.markets 에서 가입',
      '좌측 상단 "Paper" 탭 → API Keys → Generate New Key',
      'API Key ID와 Secret Key 복사 (Secret은 한 번만 표시됨)',
      '모의투자: ALPACA_BASE_URL=https://paper-api.alpaca.markets',
      '실제 거래: ALPACA_BASE_URL=https://api.alpaca.markets',
    ],
  },
  {
    title: '2. FMP API 키 발급',
    content: [
      'https://financialmodelingprep.com 에서 무료 가입',
      '대시보드에서 API Key 복사',
      '용도: 배당금 데이터 조회',
    ],
  },
  {
    title: '3. ExchangeRate-API 키 발급',
    content: [
      'https://www.exchangerate-api.com 에서 무료 가입',
      '대시보드에서 API Key 복사',
      '용도: KRW/USD 실시간 환율',
    ],
  },
  {
    title: '4. VAPID 키 생성 (푸시 알림용)',
    content: [
      '프로젝트 폴더에서 아래 명령어 실행:',
      'node -e "const wp=require(\'web-push\'); const k=wp.generateVAPIDKeys(); console.log(k)"',
      '출력된 publicKey, privateKey를 .env에 입력',
    ],
  },
  {
    title: '5. .env 파일 설정 후 실행',
    content: [
      '.env.example 을 복사해 .env 파일 생성',
      '위 키들을 모두 입력',
      'npm install',
      'npx prisma migrate dev',
      'npm start',
      'http://localhost:3000 에서 확인',
    ],
  },
]

export default function SetupGuide() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div>
          <p className="text-white font-semibold text-sm text-left">셋업 가이드</p>
          <p className="text-gray-500 text-xs text-left mt-0.5">지인에게 소스 공유 시 참고</p>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-800">
          {/* .env 파일 위치 안내 */}
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-950">
            <p className="text-xs text-gray-400 mb-1">설정 파일 위치</p>
            <code className="text-blue-300 text-xs bg-gray-800 px-2 py-1 rounded block">
              프로젝트 루트 / .env
            </code>
          </div>

          {/* 단계별 가이드 */}
          {STEPS.map((step, i) => (
            <div key={i} className="border-b border-gray-800 last:border-0">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <p className="text-sm text-white">{step.title}</p>
                {expanded === i
                  ? <ChevronUp size={14} className="text-gray-500 shrink-0" />
                  : <ChevronDown size={14} className="text-gray-500 shrink-0" />}
              </button>
              {expanded === i && (
                <div className="px-4 pb-3 space-y-1.5">
                  {step.content.map((line, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <span className="text-gray-600 text-xs mt-0.5 shrink-0">•</span>
                      <p className="text-xs text-gray-300 font-mono leading-relaxed">{line}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
