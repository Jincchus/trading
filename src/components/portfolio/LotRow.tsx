import LotStrategyBadge from './LotStrategyBadge'

interface LotDetail {
  id: string
  quantity: number
  remainingQty: number
  purchasePrice: number
  purchaseDate: string
  unrealizedPL: number
  unrealizedPLPct: number
  status: string
  strategyId: string | null
}

export default function LotRow({ lot }: { lot: LotDetail }) {
  const isUp = lot.unrealizedPL >= 0
  const date = lot.purchaseDate.slice(0, 10)

  return (
    <div className="px-4 py-3 flex justify-between items-start border-b border-gray-800 last:border-0 bg-gray-950">
      <div>
        <p className="text-xs text-gray-300">{date}</p>
        <p className="text-xs text-gray-500">
          {lot.remainingQty}주 · 취득가 ${lot.purchasePrice.toFixed(2)}
        </p>
        <LotStrategyBadge lotId={lot.id} currentStrategyId={lot.strategyId} />
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{lot.unrealizedPLPct.toFixed(2)}%
        </p>
        <p className={`text-xs ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}${lot.unrealizedPL.toFixed(2)}
        </p>
      </div>
    </div>
  )
}
