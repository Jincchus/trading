import TopBar from '@/components/layout/TopBar'
import AccountSummary from '@/components/account/AccountSummary'

export default function HomePage() {
  return (
    <>
      <TopBar title="홈" />
      <div className="p-4 space-y-4">
        <AccountSummary />
      </div>
    </>
  )
}
