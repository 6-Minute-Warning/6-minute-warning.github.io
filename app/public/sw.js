self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    message = { data: { body: event.data.text() } }
  }
  const note = { ...message.notification, ...message.data }
  event.waitUntil(
    self.registration.showNotification(note.title || '6MW Backstage', {
      body: note.body || '',
      icon: '/icon-192.png',
      tag: note.tag || undefined,
      data: { link: note.link || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = new URL(event.notification.data?.link || '/', self.location.origin)
  const target = link.origin === self.location.origin ? link.href : self.location.origin
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (!open) return self.clients.openWindow(target)
      await open.focus()
      return open.navigate(target).catch(() => self.clients.openWindow(target))
    }),
  )
})
