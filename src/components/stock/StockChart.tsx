'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, UTCTimestamp } from 'lightweight-charts'

interface Bar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

type Period = '1D' | '1W' | '1M' | '1Y' | 'ALL'

const PERIOD_CONFIG: Record<Period, { timeframe: string; days?: number; label: string }> = {
  '1D': { timeframe: '1Min', days: 1,   label: '1일' },
  '1W': { timeframe: '15Min', days: 7,  label: '1주' },
  '1M': { timeframe: '1Hour', days: 30, label: '1달' },
  '1Y': { timeframe: '1Day', days: 365, label: '1년' },
  'ALL': { timeframe: '1Day',            label: '전체' },
}

function toTs(t: string): UTCTimestamp {
  return Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp
}

function calcSMA(bars: Bar[], period: number): { time: UTCTimestamp; value: number }[] {
  return bars
    .map((bar, i) => {
      if (i < period - 1) return null
      const avg = bars.slice(i - period + 1, i + 1).reduce((s, b) => s + b.c, 0) / period
      return { time: toTs(bar.t), value: avg }
    })
    .filter(Boolean) as { time: UTCTimestamp; value: number }[]
}

export default function StockChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [period, setPeriod] = useState<Period>('1M')
  const [loading, setLoading] = useState(true)

  const buildChart = useCallback(async () => {
    if (!containerRef.current) return
    setLoading(true)

    const { timeframe, days } = PERIOD_CONFIG[period]
    const params = new URLSearchParams({ timeframe, limit: '1000' })
    if (days) {
      const start = new Date()
      start.setDate(start.getDate() - days)
      params.set('start', start.toISOString().slice(0, 10))
    }

    const res = await fetch(`/api/stocks/${ticker}/bars?${params}`)
    const json = await res.json() as { bars?: Bar[] }
    const bars = json.bars ?? []

    containerRef.current.innerHTML = ''

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: containerRef.current.clientWidth,
      height: 300,
      timeScale: { timeVisible: period === '1D', secondsVisible: false },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })

    const sma5  = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1 })
    const sma20 = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1 })

    candleSeries.setData(bars.map((b) => ({
      time: toTs(b.t), open: b.o, high: b.h, low: b.l, close: b.c,
    })))

    volSeries.setData(bars.map((b) => ({
      time: toTs(b.t), value: b.v, color: b.c >= b.o ? '#22c55e40' : '#ef444440',
    })))

    if (bars.length > 5)  sma5.setData(calcSMA(bars, 5))
    if (bars.length > 20) sma20.setData(calcSMA(bars, 20))

    chart.timeScale().fitContent()
    setLoading(false)
  }, [ticker, period])

  useEffect(() => { buildChart() }, [buildChart])

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 p-3 border-b border-gray-800">
        {(Object.keys(PERIOD_CONFIG) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {PERIOD_CONFIG[p].label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="w-3 h-0.5 bg-amber-400 inline-block" />
          <span className="text-[10px] text-gray-400">MA5</span>
          <span className="w-3 h-0.5 bg-violet-400 inline-block" />
          <span className="text-[10px] text-gray-400">MA20</span>
        </div>
      </div>
      {loading && <div className="animate-pulse h-[300px] bg-gray-800" />}
      <div ref={containerRef} className={loading ? 'sr-only' : ''} />
    </div>
  )
}
