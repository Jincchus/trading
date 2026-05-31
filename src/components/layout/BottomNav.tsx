'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Bot, Search, ShoppingCart, Wallet, Bell, Settings } from 'lucide-react'

const NAV = [
  { href: '/', label: '홈', icon: Home },
  { href: '/portfolio', label: '포트폴리오', icon: BarChart2 },
  { href: '/bot', label: '봇', icon: Bot },
  { href: '/explore', label: '탐색', icon: Search },
  { href: '/orders', label: '주문', icon: ShoppingCart },
  { href: '/assets', label: '자산', icon: Wallet },
  { href: '/alerts', label: '알림', icon: Bell },
  { href: '/settings', label: '설정', icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg ${
                active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
