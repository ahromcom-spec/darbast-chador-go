// OneSignal SDK worker has been disabled.
// Project now uses Najva for web push notifications (its SW is registered automatically by the Najva mini-script).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
    clients.forEach((client) => client.navigate && client.navigate(client.url));
  }));
});
