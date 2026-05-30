'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import FxSummary from '@/components/assets/FxSummary'
import FxRecordList from '@/components/assets/FxRecordList'
import FxRecordForm from '@/components/assets/FxRecordForm'
import WiseCsvUpload from '@/components/assets/WiseCsvUpload'
import TaxGuide from '@/components/assets/TaxGuide'
import TaxExport from '@/components/assets/TaxExport'
import DividendHistory from '@/components/assets/DividendHistory'

type Tab = '환전' | '세금'

export default function AssetsPage() {
  const [tab, setTab] = useState<Tab>('환전')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((k) => k + 1)

  return (
    <>
      <TopBar title="자산 관리" />
      <div className="flex border-b border-gray-800 bg-gray-900">
        {(['환전', '세금'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              tab === t ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === '환전' && (
          <>
            <FxSummary />
            <WiseCsvUpload onSuccess={refresh} />
            <FxRecordForm onSuccess={refresh} />
            <FxRecordList refreshKey={refreshKey} />
          </>
        )}
        {tab === '세금' && (
          <>
            <TaxGuide />
            <DividendHistory />
            <TaxExport />
          </>
        )}
      </div>
    </>
  )
}
