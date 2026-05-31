'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, UTCTimestamp, IChartApi, ISeriesApi, LineData } from 'lightweight-charts'

interface Bar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

type Period = 'LIVE' | 'MIN' | '1D' | '1W' | '1M' | '1Y' | 'ALL'

type MinuteInterval = '1Min' | '5Min' | '15Min' | '30Min' | '1Hour' | '2Hour' | '4Hour'

const MINUTE_OPTIONS: { value: MinuteInterval; label: string; days: number }[] = [
  { value: '1Min',  label: '1분',   days: 3  },
  { value: '5Min',  label: '5분',   days: 7  },
  { value: '15Min', label: '15분',  days: 14 },
  { value: '30Min', label: '30분',  days: 30 },
  { value: '1Hour', label: '60분',  days: 60 },
  { value: '2Hour', label: '120분', days: 90 },
  { value: '4Hour', label: '240분', days: 120 },
]

const PERIOD_CONFIG: Record<Exclude<Period, 'LIVE' | 'MIN'>, { timeframe: string; days?: number; label: string }> = {
  '1D': { timeframe: '5Min', days: 3,   label: '1일' },
  '1W': { timeframe: '15Min', days: 7,  label: '1주' },
  '1M': { timeframe: '1Hour', days: 30, label: '1달' },
  '1Y': { timeframe: '1Day', days: 365, label: '1년' },
  'ALL': { timeframe: '1Day', days: 1825, label: '전체' },
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

// 실시간 틱차트 (1일 모드)
function RealtimeChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ticksRef = useRef<LineData<UTCTimestamp>[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      width: containerRef.current.clientWidth,
      height: 300,
      timeScale: { timeVisible: true, secondsVisible: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true },
    })
    const series = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 })
    chartRef.current = chart
    seriesRef.current = series

    // 초기 틱 데이터 복원
    if (ticksRef.current.length > 0) {
      series.setData(ticksRef.current)
      chart.timeScale().fitContent()
    }

    return () => { chart.remove() }
  }, [])

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => ws.send(JSON.stringify({ action: 'subscribe', ticker }))

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { ticker: string; price: number; timestamp: string }
        if (msg.ticker !== ticker) return

        const point: LineData<UTCTimestamp> = {
          time: toTs(msg.timestamp),
          value: msg.price,
        }
        ticksRef.current = [...ticksRef.current.slice(-500), point]

        if (seriesRef.current) {
          seriesRef.current.update(point)
        }
      } catch {}
    }

    return () => ws.close()
  }, [ticker])

  return (
    <div className="relative h-[300px]">
      <div ref={containerRef} className="h-[300px]" />
      <p className="absolute top-2 right-3 text-[10px] text-blue-400">● 실시간</p>
    </div>
  )
}

const MA_CONFIG = [
  { period: 5,   color: '#f59e0b', label: 'MA5' },
  { period: 20,  color: '#8b5cf6', label: 'MA20' },
  { period: 60,  color: '#06b6d4', label: 'MA60' },
  { period: 120, color: '#f97316', label: 'MA120' },
]

function fmtPrice(v: number) { return v.toFixed(2) }
function fmtVol(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
  return String(v)
}

export default function StockChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const [period, setPeriod] = useState<Period>('1M')
  const [minuteInterval, setMinuteInterval] = useState<MinuteInterval>('5Min')
  const [showMinuteDropdown, setShowMinuteDropdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  const buildChart = useCallback(async () => {
    if (!containerRef.current || period === 'LIVE') return
    setLoading(true)
    setEmpty(false)

    try {
      let timeframe: string
      let days: number | undefined

      if (period === 'MIN') {
        const opt = MINUTE_OPTIONS.find((o) => o.value === minuteInterval)!
        timeframe = opt.value
        days = opt.days
      } else {
        const cfg = PERIOD_CONFIG[period as Exclude<Period, 'LIVE' | 'MIN'>]
        timeframe = cfg.timeframe
        days = cfg.days
      }
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

      if (bars.length === 0) {
        setEmpty(true)
        return
      }

      const showTime = period === 'MIN' || period === '1D'
      const chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#9ca3af' },
        grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
        width: containerRef.current.clientWidth,
        height: 300,
        timeScale: { timeVisible: showTime, secondsVisible: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: false } },
        crosshair: { mode: 1 },
      })

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#ef4444', downColor: '#3b82f6',
        borderVisible: false,
        wickUpColor: '#ef4444', wickDownColor: '#3b82f6',
      })

      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })

      const maSeries = MA_CONFIG.map(({ color }) =>
        chart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        })
      )

      const candleData = bars.map((b) => ({
        time: toTs(b.t), open: b.o, high: b.h, low: b.l, close: b.c,
      }))
      candleSeries.setData(candleData)

      volSeries.setData(bars.map((b) => ({
        time: toTs(b.t), value: b.v, color: b.c >= b.o ? '#ef444440' : '#3b82f640',
      })))

      MA_CONFIG.forEach(({ period: p }, i) => {
        if (bars.length > p) maSeries[i].setData(calcSMA(bars, p))
      })

      // 크로스헤어 인포
      chart.subscribeCrosshairMove((param) => {
        if (!infoRef.current) return
        if (!param.time || !param.point) {
          infoRef.current.innerHTML = ''
          return
        }
        const candle = param.seriesData.get(candleSeries) as { open: number; high: number; low: number; close: number } | undefined
        if (!candle) return

        const ts = param.time as UTCTimestamp
        const date = new Date(ts * 1000)
        const dateStr = showTime
          ? date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })

        const vol = param.seriesData.get(volSeries) as { value: number } | undefined
        const isUp = candle.close >= candle.open
        const clr = isUp ? '#ef4444' : '#3b82f6'

        infoRef.current.innerHTML = `
          <span style="color:#6b7280">${dateStr}</span>
          <span style="color:${clr}">O:${fmtPrice(candle.open)} H:${fmtPrice(candle.high)} L:${fmtPrice(candle.low)} C:${fmtPrice(candle.close)}</span>
          ${vol ? `<span style="color:#4b5563">V:${fmtVol(vol.value)}</span>` : ''}
        `
      })

      chart.timeScale().fitContent()
    } catch (e) {
      console.error('[Chart] buildChart error:', e)
      setEmpty(true)
    } finally {
      setLoading(false)
    }
  }, [ticker, period, minuteInterval])

  useEffect(() => { buildChart() }, [buildChart])

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 p-3 border-b border-gray-800 overflow-x-auto no-scrollbar">
        {/* 실시간 */}
        <button
          onClick={() => setPeriod('LIVE')}
          className={`shrink-0 px-3 py-1 text-xs rounded-md font-medium transition-colors ${
            period === 'LIVE' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          실시간
        </button>

        {/* 분봉 드롭다운 */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setPeriod('MIN'); setShowMinuteDropdown((v) => !v) }}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 ${
              period === 'MIN' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {period === 'MIN' ? MINUTE_OPTIONS.find((o) => o.value === minuteInterval)?.label : '분봉'}
            <span className="text-[10px]">▼</span>
          </button>
          {showMinuteDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg overflow-hidden z-50 shadow-lg min-w-[80px]">
              {MINUTE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setMinuteInterval(opt.value)
                    setPeriod('MIN')
                    setShowMinuteDropdown(false)
                  }}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-700 transition-colors ${
                    minuteInterval === opt.value && period === 'MIN' ? 'text-blue-400' : 'text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 일/주/월/년/전체 */}
        {(Object.keys(PERIOD_CONFIG) as Exclude<Period, 'LIVE' | 'MIN'>[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); setShowMinuteDropdown(false) }}
            className={`shrink-0 px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {PERIOD_CONFIG[p].label}
          </button>
        ))}

      </div>

      {period === 'LIVE' ? (
        <RealtimeChart ticker={ticker} />
      ) : (
        <div className="relative h-[300px]">
          {loading && <div className="absolute inset-0 z-10 animate-pulse bg-gray-800" />}
          {!loading && empty && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-sm">차트 데이터가 없습니다</p>
            </div>
          )}
          {!loading && !empty && (
            <div className="absolute top-2 left-3 right-3 z-10 pointer-events-none space-y-0.5">
              {/* MA 범례 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">이동평균선 :</span>
                {MA_CONFIG.map(({ period: p, color }) => (
                  <span key={p} className="text-[10px] font-medium" style={{ color }}>
                    {p}
                  </span>
                ))}
              </div>
              {/* 크로스헤어 OHLCV 인포 */}
              <div
                ref={infoRef}
                className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]"
              />
            </div>
          )}
          <div ref={containerRef} className="h-[300px]" />
        </div>
      )}
    </div>
  )
}
