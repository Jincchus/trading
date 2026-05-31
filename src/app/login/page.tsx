'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'

function LoginForm() {
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const raw = params.get('from') ?? '/'
        const to = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
        window.location.replace(to)  // 풀 리로드 — 미들웨어가 새 세션 쿠키를 바로 인식
      } else {
        const data = await res.json() as { error?: string }
        setError(data.error ?? '로그인 실패')
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
        autoFocus
        className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
      />
      {error && <p className="text-red-400 text-xs px-1">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
      >
        {loading ? '확인 중...' : '로그인'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gray-800 rounded-full p-4">
            <Lock size={28} className="text-blue-400" />
          </div>
          <h1 className="text-white text-xl font-semibold">주식 트레이딩</h1>
          <p className="text-gray-500 text-sm">비밀번호를 입력하세요</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
