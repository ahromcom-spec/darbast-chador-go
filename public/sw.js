const CACHE_NAME = 'ahrom-shell-v1';
const RUNTIME_CACHE = 'ahrom-runtime-v1';

// فقط App Shell اصلی کش می‌شود
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/ahrom-app-icon.png',
  '/ahrom-logo-original.png'
];

// Install - فقط Shell اصلی کش می‌شود
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - پاکسازی cache های قدیمی
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - استراتژی هوشمند: Shell از cache، بقیه از network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط درخواست‌های همان origin
  if (url.origin !== self.location.origin) {
    return;
  }

  // برای Navigation requests (صفحات HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request).then((response) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
              return response;
            });
          });
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // برای Assets (JS, CSS, تصاویر) - Network First با Runtime Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // کش فقط برای پاسخ‌های موفق
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // اگر network در دسترس نیست، از cache استفاده کن
        return caches.match(request);
      })
  );
});
