'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import ComparisonChart, { ComparisonLine, STRATEGY_COLORS } from '@/components/bot/ComparisonChart'
import StrategyAccordion from '@/components/bot/StrategyAccordion'
import AssetCard from '@/components/bot/AssetCard'
import OverviewTab from '@/components/bot/OverviewTab'
import PositionsTab from '@/components/bot/PositionsTab'
import TradesTab from '@/components/bot/TradesTab'
import WatchlistCard from '@/components/bot/WatchlistCard'
import {
  Strategy, PortfolioPoint, Performance, Trade, Position,
  getStrategies, getPortfolio, getPerformance, getTrades, getPositions,
  getWatchlist, liquidateAll,
} from '@/lib/bot-api'
import { Period, tabLabel, buildComparisonSeries } from '@/lib/bot-format'

type SubTab = 'overview' | 'positions' | 'trades'
const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'overview', label: '개요' }, { id: 'positions', label: '포지션' }, { id: 'trades', label: '체결' },
]
const POLL_MS = 30_000

export default function BotPage() {
  const [strategies, setStrategies] = useState<Strategy[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [period, setPeriod] = useState<Period>('30d')
  const [subTab, setSubTab] = useState<SubTab>('overview')
  const [lines, setLines] = useState<ComparisonLine[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioPoint[]>([])
  const [perf, setPerf] = useState<Performance | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [error, setError] = useState(false)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const inFlight = useRef(false)

  // selectedId를 ref로도 들고 있어 폴링 클로저가 항상 최신값 참조
  const selectedRef = useRef<number | null>(null)
  selectedRef.current = selectedId

  // 전략 목록 + 비교차트 (폴링/수동/제어후). 중첩 폴링만 inFlight로 방지.
  const loadAll = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const strats = await getStrategies()
      setStrategies(strats)
      setError(false)
      getWatchlist().then((w) => setWatchlist(w.symbols)).catch(() => {})

      // 선택 전략 결정 (없거나 사라졌으면 첫 번째)
      if (selectedRef.current === null || !strats.some((s) => s.id === selectedRef.current)) {
        setSelectedId(strats.length > 0 ? strats[0].id : null)
      }

      // 비교차트: 전체 전략 portfolio 병렬
      const portfolios = await Promise.all(
        strats.map((s) => getPortfolio(s.id).catch(() => [] as PortfolioPoint[])),
      )
      setLines(strats.map((s, i) => {
        const series = buildComparisonSeries(portfolios[i], parseFloat(s.budget))
        return {
          id: s.id, label: tabLabel(s.name, s.id), color: STRATEGY_COLORS[i % STRATEGY_COLORS.length],
          series, lastPct: series.length > 0 ? series[series.length - 1].value : 0,
        }
      }))
    } catch {
      setError(true)
    } finally {
      inFlight.current = false
    }
  }, [])

  // 선택 전략 상세. 탭 전환마다 항상 실행돼야 하므로 inFlight 가드 없음.
  const loadSelected = useCallback(async (id: number | null) => {
    if (id === null) {
      setPortfolio([]); setPerf(null); setPositions([]); setTrades([])
      return
    }
    const [pfHist, pf, ps, tr] = await Promise.all([
      getPortfolio(id).catch(() => [] as PortfolioPoint[]),
      getPerformance(id).catch(() => [] as Performance[]),
      getPositions(id).catch(() => [] as Position[]),
      getTrades(id).catch(() => [] as Trade[]),
    ])
    setPortfolio(pfHist)
    setPerf(pf.length > 0 ? pf[pf.length - 1] : null)
    setPositions(ps)
    setTrades(tr)
  }, [])

  const refreshBoth = useCallback(() => {
    loadAll()
    loadSelected(selectedRef.current)
  }, [loadAll, loadSelected])

  // 최초 로드(전체) + 선택 전략 변경 시 상세 재로드
  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadSelected(selectedId) }, [selectedId, loadSelected])

  // 30초 폴링 (탭 비활성 시 정지)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      loadAll()
      loadSelected(selectedRef.current)
    }
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [loadAll, loadSelected])

  const manualRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadAll(), loadSelected(selectedRef.current)])
    setRefreshing(false)
  }

  const panic = async () => {
    if (!window.confirm('모든 봇을 멈추고 전 종목을 청산합니다. 계속할까요?')) return
    if (!window.confirm('정말 전체 청산할까요? 되돌릴 수 없습니다.')) return
    try { await liquidateAll(); refreshBoth() } catch { setError(true) }
  }

  const selected = strategies?.find((s) => s.id === selectedId) ?? null
  const selectedColor = STRATEGY_COLORS[
    Math.max(0, strategies?.findIndex((s) => s.id === selectedId) ?? 0) % STRATEGY_COLORS.length]

  return (
    <>
      <TopBar title="봇 대시보드" action={
        <button onClick={manualRefresh} disabled={refreshing} className="text-gray-400 disabled:opacity-50">
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      } />

      <div className="p-4 space-y-4">
        {error && <p className="text-red-400 text-sm">데이터를 불러올 수 없습니다.</p>}

        {strategies === null ? (
          <div className="animate-pulse h-40 bg-gray-800 rounded-xl" />
        ) : strategies.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">등록된 전략이 없습니다.</p>
        ) : (
          <>
            <button onClick={panic}
              className="w-full text-xs py-2 rounded-xl bg-red-950 text-red-400 font-semibold">
              ⚠ 전체 비상 청산 (모든 봇 정지 + 청산)
            </button>
            <WatchlistCard symbols={watchlist} onChanged={refreshBoth} />

            <ComparisonChart lines={lines} period={period} onPeriodChange={setPeriod} />

            {/* 전략 탭 */}
            <div className="flex border-b border-gray-800 overflow-x-auto">
              {strategies.map((s) => (
                <button key={s.id} onClick={() => { setSelectedId(s.id); setSubTab('overview') }}
                  className={`px-3 py-2 text-xs whitespace-nowrap ${
                    s.id === selectedId ? 'text-white border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}>
                  {tabLabel(s.name, s.id)}
                </button>
              ))}
            </div>

            {selected && (
              <div className="space-y-3">
                <StrategyAccordion strategy={selected} color={selectedColor} symbols={watchlist} onChanged={refreshBoth} />
                <AssetCard history={portfolio} budget={parseFloat(selected.budget)} />

                {/* 서브탭 */}
                <div className="flex border-b border-gray-800">
                  {SUBTABS.map((st) => (
                    <button key={st.id} onClick={() => setSubTab(st.id)}
                      className={`px-3 py-2 text-xs ${
                        subTab === st.id ? 'text-white border-b-2 border-blue-500 font-semibold' : 'text-gray-500'}`}>
                      {st.label}
                    </button>
                  ))}
                </div>

                {subTab === 'overview' && <OverviewTab perf={perf} />}
                {subTab === 'positions' && <PositionsTab positions={positions} strategyId={selected.id} onChanged={refreshBoth} />}
                {subTab === 'trades' && <TradesTab trades={trades} />}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
