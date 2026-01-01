importScripts('https://van.najva.com/static/js/service-worker.js');

// Ensure Chromium browsers consider the app installable as a PWA.
// If this worker is registered at scope '/', missing a fetch handler can block installability.
self.addEventListener('fetch', () => {});

// به‌روزرسانی App Badge وقتی نوتیفیکیشن از نجوا دریافت می‌شود
self.addEventListener('push', async (event) => {
  console.log('[Najva SW] Push received');
  
  // به‌روزرسانی App Badge
  try {
    if ('setAppBadge' in navigator) {
      // ارسال پیام به کلاینت‌ها برای به‌روزرسانی badge
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length > 0) {
        clients.forEach(client => {
          client.postMessage({ type: 'INCREMENT_BADGE' });
        });
      } else {
        // اگر کلاینتی باز نیست، یک badge نشان بده
        await navigator.setAppBadge(1);
      }
    }
  } catch (error) {
    console.log('[Najva SW] Badge error:', error);
  }
});

