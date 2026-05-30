export default function TradePanel({ ticker: _ }: { ticker: string }) {
  return (
    <div className="flex gap-3 pb-2">
      <button
        disabled
        className="flex-1 py-3 rounded-xl bg-green-600 opacity-40 text-white font-semibold cursor-not-allowed text-sm"
      >
        매수
      </button>
      <button
        disabled
        className="flex-1 py-3 rounded-xl bg-red-600 opacity-40 text-white font-semibold cursor-not-allowed text-sm"
      >
        매도
      </button>
    </div>
  )
}
