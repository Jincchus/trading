'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface SearchResult {
  symbol: string
  name: string
  exchange: string
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }

    timerRef.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { setResults(d.results ?? []); setOpen(true) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 300)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  const go = (symbol: string) => {
    setQuery(''); setOpen(false)
    router.push(`/stock/${symbol}`)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2.5">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목 검색 (예: AAPL, Apple)"
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
        />
        {loading && <span className="text-gray-500 text-xs">...</span>}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setOpen(false) }}><X size={14} className="text-gray-500" /></button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-xl overflow-hidden z-50 shadow-lg">
          {results.map((r) => (
            <button key={r.symbol} onClick={() => go(r.symbol)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-left border-b border-gray-700 last:border-0">
              <span className="text-white font-semibold text-sm w-16 shrink-0">{r.symbol}</span>
              <span className="text-gray-400 text-xs truncate">{r.name}</span>
              <span className="text-gray-600 text-[10px] ml-auto">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-xl px-4 py-3 z-50">
          <p className="text-gray-500 text-sm">검색 결과가 없습니다.</p>
        </div>
      )}
    </div>
  )
}
