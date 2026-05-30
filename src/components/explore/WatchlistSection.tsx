'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus } from 'lucide-react'

export default function WatchlistSection() {
  const [tickers, setTickers] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const router = useRouter()

  const load = () =>
    fetch('/api/watchlist').then((r) => r.json()).then((d) => setTickers(d.tickers ?? []))

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!input.trim()) return
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: input.trim().toUpperCase() }),
    })
    setInput(''); setAdding(false); load()
  }

  const remove = async (ticker: string) => {
    await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-xs uppercase tracking-wide">관심종목</p>
        <button onClick={() => setAdding((v) => !v)} className="text-blue-400 p-1"><Plus size={16} /></button>
      </div>

      {adding && (
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="티커 입력 (예: NVDA)"
            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-500"
            autoFocus />
          <button onClick={add} disabled={!input.trim()} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-40">추가</button>
        </div>
      )}

      {tickers.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">관심종목을 추가해 보세요.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tickers.map((t) => (
            <div key={t} className="flex items-center gap-1.5 bg-gray-900 rounded-lg px-3 py-2">
              <button onClick={() => router.push(`/stock/${t}`)} className="text-white text-sm font-semibold">{t}</button>
              <button onClick={() => remove(t)} className="text-gray-500 hover:text-red-400"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
