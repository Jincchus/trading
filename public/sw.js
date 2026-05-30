self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? '주식 알림', {
      body: data.body ?? '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow('/alerts')
    })
  )
})
