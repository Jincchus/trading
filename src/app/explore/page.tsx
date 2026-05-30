import TopBar from '@/components/layout/TopBar'
import SearchBar from '@/components/explore/SearchBar'
import ActivesList from '@/components/explore/ActivesList'
import ThemeGrid from '@/components/explore/ThemeGrid'
import WatchlistSection from '@/components/explore/WatchlistSection'

export default function ExplorePage() {
  return (
    <>
      <TopBar title="종목 탐색" />
      <div className="p-4 space-y-6">
        <SearchBar />
        <WatchlistSection />
        <ThemeGrid />
        <ActivesList />
      </div>
    </>
  )
}
