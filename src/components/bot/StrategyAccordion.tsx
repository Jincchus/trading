'use client'

import { useState } from 'react'
import { ChevronRight, Play, Square } from 'lucide-react'
import { Strategy, startStrategy, stopStrategy } from '@/lib/bot-api'
import { formatUsd } from '@/lib/bot-format'

// strategy_type → 설명/종목 하드코딩 맵
const STRATEGY_META: Record<string, { desc: string; symbols: string[] }> = {
  ma_crossover: {
    desc: '단기(10)·장기(30) 이동평균 크로스오버 전략. 골든크로스 매수, 데드크로스 청산.',
    symbols: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'],
  },
}

const STATUS_BADGE: Record<string, string> = {
  running: 'bg-emerald-900 text-emerald-400',
  stopped: 'bg-gray-700 text-gray-300',
  failed: 'bg-red-900 text-red-400',
}

export default function StrategyAccordion({
  strategy, color, onChanged,
}: { strategy: Strategy; color: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = STRATEGY_META[strategy.strategy_type] ?? { desc: strategy.strategy_type, symbols: [] }
  const isRunning = strategy.status === 'running'

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const verb = isRunning ? '정지' : '시작'
    if (!window.confirm(`${strategy.name} 전략을 ${verb}할까요?`)) return
    setBusy(true); setError(null)
    try {
      await (isRunning ? stopStrategy(strategy.id) : startStrategy(strategy.id))
      onChanged()
    } catch {
      setError(`전략 ${verb} 실패`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <span className="text-white text-sm font-semibold">{strategy.name}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[strategy.status] ?? STATUS_BADGE.stopped}`}>
            ● {strategy.status}
          </span>
          <button onClick={toggle} disabled={busy}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full disabled:opacity-50 ${
              isRunning ? 'bg-red-950 text-red-400' : 'bg-emerald-950 text-emerald-400'}`}>
            {isRunning ? <Square size={11} /> : <Play size={11} />}
            {busy ? '...' : isRunning ? '정지' : '시작'}
          </button>
          <ChevronRight size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </div>
      {error && <p className="px-3 pb-2 text-red-400 text-xs">{error}</p>}
      {open && (
        <div className="px-3 pb-3 border-t border-gray-800">
          <p className="text-gray-400 text-[11px] leading-relaxed my-2">{meta.desc}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">{strategy.run_interval}</span>
            <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">예산 {formatUsd(strategy.budget)}</span>
            {meta.symbols.length > 0 && (
              <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">{meta.symbols.join(' · ')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
