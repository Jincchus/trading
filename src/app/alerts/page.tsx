'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import PushToggle from '@/components/alerts/PushToggle'
import AlertForm from '@/components/alerts/AlertForm'
import AlertList from '@/components/alerts/AlertList'
import AlertHistoryList from '@/components/alerts/AlertHistoryList'

type Tab = '설정' | '내역'

export default function AlertsPage() {
  const [tab, setTab] = useState<Tab>('설정')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
      <TopBar title="알림" />
      <div className="flex border-b border-gray-800 bg-gray-900">
        {(['설정', '내역'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-xs font-medium transition-colors ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>
      <div className="p-4 space-y-4">
        {tab === '설정' && (
          <>
            <PushToggle />
            <AlertForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            <AlertList refreshKey={refreshKey} />
          </>
        )}
        {tab === '내역' && <AlertHistoryList />}
      </div>
    </>
  )
}
