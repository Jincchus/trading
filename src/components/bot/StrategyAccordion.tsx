'use client'

import { useState } from 'react'
import { ChevronRight, Play, Square } from 'lucide-react'
import {
  Strategy, startStrategy, stopStrategy, patchStrategy, liquidateStrategy,
} from '@/lib/bot-api'
import { formatUsd } from '@/lib/bot-format'

// strategy_type → 설명
const STRATEGY_DESC: Record<string, string> = {
  ma_crossover: '단기(10)·장기(30) 이동평균 크로스오버 전략. 골든크로스 매수, 데드크로스 청산.',
  rsi_reversion: 'RSI(14) 평균회귀 전략. 과매도(RSI<30) 매수, 과매수(RSI>70) 청산.',
  macd: 'MACD 시그널 크로스 모멘텀 전략. MACD가 시그널선 상향 돌파 시 매수, 하향 돌파 시 청산.',
  bollinger: '볼린저 밴드(20, 2σ) 평균회귀 전략. 하단 밴드 터치 매수, 중심선(SMA20) 회귀 청산.',
}

const STATUS_BADGE: Record<string, string> = {
  running: 'bg-emerald-900 text-emerald-400',
  stopped: 'bg-gray-700 text-gray-300',
  failed: 'bg-red-900 text-red-400',
}

export default function StrategyAccordion({
  strategy, color, symbols, onChanged,
}: { strategy: Strategy; color: string; symbols: string[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pctInput, setPctInput] = useState(String(Math.round(parseFloat(strategy.position_size) * 100)))
  const desc = STRATEGY_DESC[strategy.strategy_type] ?? strategy.strategy_type
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

  const savePct = async () => {
    const pct = parseFloat(pctInput)
    if (!(pct > 0 && pct <= 100)) { setError('1~100 사이로 입력하세요'); return }
    setBusy(true); setError(null)
    try {
      await patchStrategy(strategy.id, pct / 100)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '비중 변경 실패')
    } finally {
      setBusy(false)
    }
  }

  const liquidate = async () => {
    if (!window.confirm(`${strategy.name} 봇을 멈추고 전량 청산할까요?`)) return
    setBusy(true); setError(null)
    try {
      await liquidateStrategy(strategy.id)
      onChanged()
    } catch {
      setError('청산 실패')
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
          <p className="text-gray-400 text-[11px] leading-relaxed my-2">{desc}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">{strategy.run_interval}</span>
            <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">예산 {formatUsd(strategy.budget)}</span>
            {symbols.length > 0 && (
              <span className="bg-gray-800 text-gray-400 text-[9px] px-2 py-0.5 rounded-full">{symbols.join(' · ')}</span>
            )}
          </div>

          {/* 포지션 크기(%) */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-gray-400 text-[11px]">종목당 비중</span>
            <input type="number" min={1} max={100} value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
              className="w-16 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 outline-none" />
            <span className="text-gray-500 text-[11px]">%</span>
            <button onClick={savePct} disabled={busy}
              className="text-[11px] px-2.5 py-1 rounded-full bg-blue-950 text-blue-400 disabled:opacity-40">변경</button>
          </div>
          <p className="text-gray-600 text-[10px] mt-1">다음 봇 재시작부터 적용돼요</p>

          {/* 이 봇 청산 */}
          <button onClick={liquidate} disabled={busy}
            className="mt-3 w-full text-[11px] py-1.5 rounded-lg bg-red-950 text-red-400 font-semibold disabled:opacity-40">
            이 봇 청산 (정지 + 전량 매도)
          </button>
        </div>
      )}
    </div>
  )
}
