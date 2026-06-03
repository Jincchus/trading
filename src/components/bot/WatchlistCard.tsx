'use client'

import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { updateWatchlist } from '@/lib/bot-api'
import { addSymbol, normalizeSymbol } from '@/lib/bot-format'

export default function WatchlistCard({
  symbols, onChanged,
}: { symbols: string[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<string[]>(symbols)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 상위 종목이 (내용 기준) 바뀌면 draft 동기화. 폴링으로 동일 내용이 와도 편집 유지.
  const symbolsKey = symbols.join(',')
  useEffect(() => { setDraft(symbols) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [symbolsKey])

  const dirty = draft.join(',') !== symbols.join(',')

  const add = () => { setDraft((d) => addSymbol(d, input)); setInput('') }
  const remove = (sym: string) => setDraft((d) => d.filter((s) => s !== sym))

  const save = async () => {
    if (draft.length === 0) { setError('최소 1개 종목이 필요합니다'); return }
    if (!window.confirm('종목을 변경하면 빠진 종목은 자동 청산되고 돌던 봇이 재시작됩니다. 진행할까요?')) return
    setBusy(true); setError(null)
    try {
      await updateWatchlist(draft)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-white text-sm font-semibold">감시 종목 (공통)</span>
        <button onClick={save} disabled={busy || !dirty}
          className="text-[11px] px-2.5 py-1 rounded-full bg-blue-950 text-blue-400 disabled:opacity-40">
          {busy ? '저장 중...' : '저장'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {draft.map((sym) => (
          <span key={sym} className="flex items-center gap-1 bg-gray-800 text-gray-200 text-[11px] px-2 py-0.5 rounded-full">
            {sym}
            <button onClick={() => remove(sym)} className="text-gray-500 hover:text-red-400"><X size={11} /></button>
          </span>
        ))}
        {draft.length === 0 && <span className="text-gray-600 text-[11px]">종목 없음</span>}
      </div>
      <div className="flex gap-1.5">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="예: TSLA"
          className="flex-1 bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none placeholder-gray-600" />
        <button onClick={add} disabled={!normalizeSymbol(input)}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40">
          <Plus size={12} /> 추가
        </button>
      </div>
      <p className="text-gray-600 text-[10px]">저장 시 검증 → 빠진 종목 자동청산 → 봇 자동 재시작</p>
      {error && <p className="text-red-400 text-[11px]">{error}</p>}
    </div>
  )
}
