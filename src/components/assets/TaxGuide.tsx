'use client'

import { useEffect, useState } from 'react'

interface TaxSummary {
  totalGainKrw: number
  taxableGainKrw: number
  estimatedTaxKrw: number
  exemptionKrw: number
}

export default function TaxGuide() {
  const [summary, setSummary] = useState<TaxSummary | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/tax-records').then((r) => r.json()).then(setSummary).catch(() => {})
  }, [])

  const fmt = (v: number) => v.toLocaleString('ko-KR') + '원'

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <p className="text-white font-semibold text-sm">해외주식 양도소득세</p>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {summary && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">
          <div>
            <p className="text-xs text-gray-400">올해 총 양도차익</p>
            <p className={`text-sm font-semibold ${summary.totalGainKrw >= 0 ? 'text-white' : 'text-red-400'}`}>
              {fmt(Math.round(summary.totalGainKrw))}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">기본공제</p>
            <p className="text-sm text-gray-300">{fmt(summary.exemptionKrw)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">과세표준</p>
            <p className="text-sm text-white">{fmt(Math.round(summary.taxableGainKrw))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">예상 세액 (22%)</p>
            <p className="text-sm font-semibold text-amber-400">{fmt(summary.estimatedTaxKrw)}</p>
          </div>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-800 pt-3 text-xs text-gray-400">
          <p>• 연간 해외주식 양도차익 <span className="text-white">250만원 기본공제</span></p>
          <p>• 초과분에 <span className="text-white">22% 세율</span> 적용 (지방소득세 포함)</p>
          <p>• 신고 기간: <span className="text-white">매년 5월</span> (종합소득세 신고)</p>
          <p>• 신고 방법: 홈택스 → 세금신고 → 종합소득세 → 해외주식 양도소득</p>
          <p className="text-gray-500">* 표시된 세액은 참고용이며, 정확한 신고는 전문가 상담을 권장합니다.</p>
        </div>
      )}
    </div>
  )
}
