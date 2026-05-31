'use client'

import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, UTCTimestamp, IChartApi } from 'lightweight-charts'
import { SeriesPoint, Period, filterByPeriod } from '@/lib/bot-format'

export const STRATEGY_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']

export interface ComparisonLine {
  id: number
  label: string
  color: string
  series: SeriesPoint[]   // buildComparisonSeries 결과 (value 단위 %)
  lastPct: number         // 마지막 값 (범례용, % 단위)
}

const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: '7일' }, { id: '30d', label: '30일' }, { id: 'all', label: '전체' },
]

export default function ComparisonChart({
  lines, period, onPeriodChange,
}: { lines: ComparisonLine[]; period: Period; onPeriodChange: (p: Period) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<Map<number, ReturnType<IChartApi['addSeries']>>>(new Map())

  // 차트 1회 생성
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: containerRef.current.clientWidth,
      height: 160,
      timeScale: { timeVisible: false },
      rightPriceScale: { borderColor: '#1f2937' },
    })
    chartRef.current = chart
    const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth })
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.remove(); seriesRef.current.clear() }
  }, [])

  // lines/period 변경 시 시리즈 갱신 (재생성 없이 setData)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const nowSec = Math.floor(Date.now() / 1000)
    const seen = new Set<number>()
    for (const line of lines) {
      seen.add(line.id)
      let s = seriesRef.current.get(line.id)
      if (!s) {
        s = chart.addSeries(LineSeries, { color: line.color, lineWidth: 2, priceLineVisible: false })
        seriesRef.current.set(line.id, s)
      } else {
        s.applyOptions({ color: line.color })
      }
      s.setData(filterByPeriod(line.series, period, nowSec) as { time: UTCTimestamp; value: number }[])
    }
    // 사라진 전략 시리즈 제거
    for (const [id, s] of seriesRef.current) {
      if (!seen.has(id)) { chart.removeSeries(s); seriesRef.current.delete(id) }
    }
    chart.timeScale().fitContent()
  }, [lines, period])

  return (
    <div className="bg-gray-900 rounded-xl p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-400 font-medium">누적 수익률 비교</span>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => onPeriodChange(p.id)}
              className={`text-[10px] px-2 py-0.5 rounded ${
                period === p.id ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-40">
        {/* 컨테이너는 항상 마운트 — 차트 생성 effect가 ref를 찾을 수 있어야 함 */}
        <div ref={containerRef} className="w-full" />
        {lines.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">표시할 데이터가 없습니다</div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {lines.map((l) => (
          <span key={l.id} className="text-[10px]" style={{ color: l.color }}>
            ● {l.label} {l.lastPct >= 0 ? '+' : ''}{l.lastPct.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}
