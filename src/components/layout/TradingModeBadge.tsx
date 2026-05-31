import { IS_LIVE } from '@/lib/env'

export default function TradingModeBadge() {
  if (!IS_LIVE) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center text-[10px] font-bold py-0.5 tracking-widest">
      ⚠ LIVE TRADING — 실거래 활성화
    </div>
  )
}
