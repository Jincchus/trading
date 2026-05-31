interface Props {
  totalValue: number
  totalUnrealizedPL: number
}

export default function PortfolioSummary({ totalValue, totalUnrealizedPL }: Props) {
  const isUp = totalUnrealizedPL >= 0
  const cost = totalValue - totalUnrealizedPL
  const pct = cost > 0 ? (totalUnrealizedPL / cost) * 100 : 0

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">총 자산</p>
      <p className="text-3xl font-bold text-white">{fmt(totalValue)}</p>
      <p className={`text-sm mt-1 ${isUp ? 'text-red-400' : 'text-blue-400'}`}>
        {isUp ? '+' : ''}{fmt(totalUnrealizedPL)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
      </p>
    </div>
  )
}
