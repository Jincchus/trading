'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const logout = async () => {
    setLoading(true)
    await fetch('/api/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-red-400 rounded-xl py-3 text-sm font-medium transition-colors"
    >
      <LogOut size={16} />
      {loading ? '로그아웃 중...' : '로그아웃'}
    </button>
  )
}
