'use client'

import { useEffect, useRef } from 'react'
import { createChart, ColorType, AreaSeries, UTCTimestamp, IChartApi } from 'lightweight-charts'
import { PortfolioPoint } from '@/lib/bot-api'
import { formatUsd, formatPct, pnlColorClass } from '@/lib/bot-format'

export default function AssetCard({ history, budget }: { history: PortfolioPoint[]; budget: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null)

  const latest = history.length > 0 ? parseFloat(history[history.length - 1].equity) : budget
  const pnl = latest - budget
  const pnlFraction = budget ? pnl / budget : 0

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#030712' }, textColor: '#9ca3af' },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      width: containerRef.current.clientWidth,
      height: 56,
      timeScale: { visible: false },
      rightPriceScale: { visible: false },
      handleScroll: false, handleScale: false,
    })
    const series = chart.addSeries(AreaSeries, {
      lineColor: '#34d399', topColor: 'rgba(52,211,153,0.25)', bottomColor: 'rgba(52,211,153,0)', lineWidth: 2,
    })
    chartRef.current = chart
    seriesRef.current = series
    const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth })
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.remove() }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(history.map((h) => ({
      time: Math.floor(new Date(h.timestamp).getTime() / 1000) as UTCTimestamp,
      value: parseFloat(h.equity),
    })))
    chartRef.current?.timeScale().fitContent()
  }, [history])

  return (
    <div className="bg-gray-900 rounded-xl p-3">
      <div className="text-gray-400 text-[10px]">총 자산</div>
      <div className="text-white text-xl font-bold">{formatUsd(latest)}</div>
      <div className={`text-xs ${pnlColorClass(pnl)}`}>
        {pnl >= 0 ? '+' : ''}{formatUsd(pnl)} ({formatPct(pnlFraction)})
      </div>
      <div className="mt-2 rounded-md overflow-hidden relative min-h-14">
        {/* 컨테이너는 항상 마운트 — 차트 생성 effect가 ref를 찾을 수 있어야 함 */}
        <div ref={containerRef} className="w-full" />
        {history.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-[11px]">자산 기록 없음</div>
        )}
      </div>
    </div>
  )
}
