'use client'

interface Tab {
  id: string
  label: string
}

interface Props {
  tabs: Tab[]
  activeTab: string
  onSelect: (id: string) => void
}

export default function CategoryTabs({ tabs, activeTab, onSelect }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
