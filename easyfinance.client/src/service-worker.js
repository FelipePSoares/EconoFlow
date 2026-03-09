importScripts('./ngsw-worker.js');

self.addEventListener('push', event => {
  let payload = { title: 'EconoFlow', body: 'You have a new notification.' };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'EconoFlow', body: event.data.text() };
    }
  }

  const targetUrl = payload?.data?.url || payload?.url || '/';
  const title = payload.title || 'EconoFlow';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/assets/icons/icon-192x192.png',
    badge: payload.badge || '/assets/icons/notification-badge-72x72.png',
    tag: payload.tag || 'econoflow-web-push',
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: targetUrl
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const matchedClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of matchedClients) {
      if (!client.url || !('focus' in client)) {
        continue;
      }

      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.navigate(targetUrl);
          await client.focus();
          return;
        }
      } catch {
        // Ignore malformed URLs from old clients.
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
