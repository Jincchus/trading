import type { ReactNode } from 'react'

export default function TopBar({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
      <div className="flex items-center justify-between h-12 max-w-md mx-auto px-4">
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {action}
      </div>
    </header>
  )
}
