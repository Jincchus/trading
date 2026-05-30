'use client'

import { usePushNotification } from '@/hooks/usePushNotification'
import { Bell, BellOff } from 'lucide-react'

export default function PushToggle() {
  const { subscribed, supported, loading, subscribe, unsubscribe } = usePushNotification()

  if (!supported) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-gray-500 text-sm">이 브라우저는 푸시 알림을 지원하지 않습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-white font-medium text-sm">알림 수신</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {subscribed ? '알림이 활성화되어 있습니다' : '목표가·체결·전략 알림을 받으세요'}
        </p>
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 ${
          subscribed ? 'bg-gray-700 text-gray-300' : 'bg-blue-600 text-white'
        }`}
      >
        {subscribed ? <BellOff size={15} /> : <Bell size={15} />}
        {loading ? '...' : subscribed ? '해제' : '허용'}
      </button>
    </div>
  )
}
