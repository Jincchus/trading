'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import PortfolioSummary from '@/components/portfolio/PortfolioSummary'
import PositionCard from '@/components/portfolio/PositionCard'
import PieChart from '@/components/portfolio/PieChart'
import CategoryTabs from '@/components/portfolio/CategoryTabs'

interface LotDetail {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  status: string
  strategyId: string | null
}

interface Position {
  ticker: string
  qty: number
  currentPrice: number
  currentValue: number
  unrealizedPL: number
  unrealizedPLPct: number
  lots: LotDetail[]
  categories: string[]
}

interface PortfolioData {
  positions: Position[]
  totalValue: number
  totalUnrealizedPL: number
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(false)

  const load = () =>
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true))

  useEffect(() => { load() }, [])

  const sync = async () => {
    setSyncing(true)
    await fetch('/api/portfolio/sync', { method: 'POST' }).catch(() => {})
    await load()
    setSyncing(false)
  }

  const allCategories = [...new Set((data?.positions ?? []).flatMap((p) => p.categories))]
  const tabs = [{ id: 'all', label: '전체' }, ...allCategories.map((c) => ({ id: c, label: c }))]

  const filtered =
    activeTab === 'all'
      ? (data?.positions ?? [])
      : (data?.positions ?? []).filter((p) => p.categories.includes(activeTab))

  const pieSlices = (data?.positions ?? []).map((p, i) => ({
    label: p.ticker,
    value: p.currentValue,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <>
      <TopBar title="포트폴리오" />
      <div className="p-4 space-y-4">
        {data ? (
          <PortfolioSummary totalValue={data.totalValue} totalUnrealizedPL={data.totalUnrealizedPL} />
        ) : error ? (
          <p className="text-red-400 text-sm p-4">포트폴리오를 불러올 수 없습니다.</p>
        ) : (
          <div className="animate-pulse h-24 bg-gray-800 rounded-xl" />
        )}

        <button
          onClick={sync}
          disabled={syncing}
          className="w-full py-2.5 text-sm text-blue-400 border border-blue-900 rounded-xl disabled:opacity-50 transition-opacity"
        >
          {syncing ? '동기화 중...' : 'Alpaca 주문 동기화'}
        </button>

        {data && data.positions.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4">
            <PieChart slices={pieSlices} />
          </div>
        )}

        {tabs.length > 1 && (
          <CategoryTabs tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} />
        )}

        <div className="space-y-3">
          {filtered.map((pos) => (
            <PositionCard key={pos.ticker} {...pos} />
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">
              {data ? '이 카테고리에 포지션이 없습니다.' : '로딩 중...'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
