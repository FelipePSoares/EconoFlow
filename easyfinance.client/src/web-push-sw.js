self.addEventListener('push', event => {
  if (!event.data) {
    return;
  }

  let payload = {};

  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title || 'EconoFlow';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/assets/favicon.ico',
    badge: payload.badge || '/assets/favicon.ico',
    tag: payload.tag || 'econoflow-web-push',
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || '/'
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
      if (client.url && 'focus' in client) {
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
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
