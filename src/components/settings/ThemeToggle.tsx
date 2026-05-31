'use client'

import { useTheme } from '@/components/ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {isDark
          ? <Moon size={18} className="text-blue-400" />
          : <Sun size={18} className="text-amber-400" />}
        <div>
          <p className="text-white font-medium text-sm">화면 테마</p>
          <p className="text-gray-400 text-xs mt-0.5">{isDark ? '다크 모드' : '라이트 모드'}</p>
        </div>
      </div>
      <button
        onClick={toggle}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
          isDark ? 'bg-gray-600' : 'bg-blue-500'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            isDark ? 'translate-x-0.5' : 'translate-x-6'
          }`}
        />
      </button>
    </div>
  )
}
