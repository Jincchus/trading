'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Theme {
  id: string
  name: string
  tickers: string[]
}

export default function ThemeGrid() {
  const [themes, setThemes] = useState<Theme[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/market/themes').then((r) => r.json()).then((d) => setThemes(d.themes ?? [])).catch(() => {})
  }, [])

  return (
    <div className="space-y-2">
      <p className="text-gray-400 text-xs uppercase tracking-wide">테마별 종목</p>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((theme) => (
          <div key={theme.id} className="bg-gray-900 rounded-xl overflow-hidden">
            <button onClick={() => setExpanded(expanded === theme.id ? null : theme.id)} className="w-full p-3 text-left">
              <p className="text-white text-sm font-semibold">{theme.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{theme.tickers.length}개 종목</p>
            </button>
            {expanded === theme.id && (
              <div className="border-t border-gray-800 p-2 flex flex-wrap gap-1">
                {theme.tickers.map((t) => (
                  <button key={t} onClick={() => router.push(`/stock/${t}`)}
                    className="text-[11px] bg-gray-800 text-blue-400 px-2 py-1 rounded-lg font-medium">{t}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
