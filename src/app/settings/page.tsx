import TopBar from '@/components/layout/TopBar'
import CategoryManager from '@/components/settings/CategoryManager'
import StrategyManager from '@/components/settings/StrategyManager'
import SetupGuide from '@/components/settings/SetupGuide'
import ThemeToggle from '@/components/settings/ThemeToggle'
import PushToggle from '@/components/alerts/PushToggle'

export default function SettingsPage() {
  return (
    <>
      <TopBar title="설정" />
      <div className="p-4 space-y-4">

        {/* 화면 테마 */}
        <ThemeToggle />

        {/* 알림 설정 */}
        <PushToggle />

        {/* 카테고리 관리 */}
        <CategoryManager />

        {/* 매매 전략 관리 */}
        <StrategyManager />

        {/* API 설정 */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          <p className="text-gray-400 text-xs uppercase tracking-wide">API 설정</p>
          <p className="text-gray-300 text-sm">
            API 키는 서버의{' '}
            <code className="bg-gray-800 px-1 py-0.5 rounded text-xs text-blue-300">.env</code>{' '}
            파일에서 관리합니다.
          </p>
          <div className="space-y-1.5 pt-1">
            {[
              { label: 'Alpaca Markets', desc: '거래·시세·계좌 (ALPACA_API_KEY)' },
              { label: 'FMP', desc: '배당금 데이터 (FMP_API_KEY)' },
              { label: 'ExchangeRate-API', desc: 'KRW/USD 환율 (EXCHANGE_RATE_API_KEY)' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-1.5 shrink-0" />
                <div>
                  <span className="text-white text-xs font-medium">{item.label}</span>
                  <span className="text-gray-500 text-xs ml-1.5">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs pt-1">키 변경 후 서버를 재시작해야 적용됩니다.</p>
        </div>

        {/* 셋업 가이드 */}
        <SetupGuide />

        {/* 앱 정보 */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-1">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">앱 정보</p>
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">버전</span>
            <span className="text-gray-300 text-xs">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">거래소</span>
            <span className="text-gray-300 text-xs">Alpaca Markets (US)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">시장</span>
            <span className="text-gray-300 text-xs">NYSE / NASDAQ</span>
          </div>
        </div>

      </div>
    </>
  )
}
