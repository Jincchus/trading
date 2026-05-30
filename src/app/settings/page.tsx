import TopBar from '@/components/layout/TopBar'
import CategoryManager from '@/components/settings/CategoryManager'
import StrategyManager from '@/components/settings/StrategyManager'

export default function SettingsPage() {
  return (
    <>
      <TopBar title="설정" />
      <div className="p-4 space-y-4">
        <CategoryManager />
        <StrategyManager />
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">API 설정</p>
          <p className="text-gray-500 text-sm">Phase 5에서 완성</p>
        </div>
      </div>
    </>
  )
}
