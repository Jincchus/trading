import TopBar from '@/components/layout/TopBar'
import PriceDisplay from '@/components/stock/PriceDisplay'
import StockChart from '@/components/stock/StockChart'
import OrderBook from '@/components/stock/OrderBook'
import DividendInfo from '@/components/stock/DividendInfo'
import TradePanel from '@/components/stock/TradePanel'

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  const symbol = ticker.toUpperCase()

  return (
    <>
      <TopBar title={symbol} />
      <div className="space-y-4 pb-4">
        <PriceDisplay ticker={symbol} />
        <div className="px-4 space-y-4">
          <StockChart ticker={symbol} />
          <OrderBook ticker={symbol} />
          <DividendInfo ticker={symbol} />
          <TradePanel ticker={symbol} />
        </div>
      </div>
    </>
  )
}
