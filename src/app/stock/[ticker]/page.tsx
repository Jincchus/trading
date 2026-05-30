import TopBar from '@/components/layout/TopBar'

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  return (
    <>
      <TopBar title={ticker} />
      <div className="p-4">
        <p className="text-gray-400">종목 상세 — Phase 2에서 완성</p>
      </div>
    </>
  )
}
