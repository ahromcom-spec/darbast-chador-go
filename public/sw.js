const CACHE_VERSION = 'ahrom-v17-hard-refresh';
const CACHE_NAME = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// فایل‌های ضروری برای نصب اولیه (App Shell) - با آیکون‌های PWA جدید
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/ahrom-pwa-icon.png',
  '/ahrom-app-icon.png',
  '/ahrom-logo.png',
  '/ahrom-logo-original.png'
];

// حداکثر تعداد آیتم‌ها در کش Runtime
const MAX_RUNTIME_CACHE_SIZE = 50;

// نصب - فقط فایل‌های Shell را کش می‌کنیم
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Installing App Shell');
        return cache.addAll(SHELL_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Allow page to tell SW to take control immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// فعال‌سازی - پاک‌سازی کش‌های قدیمی
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    
    // حذف تمام کش‌های قدیمی
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (!cacheName.startsWith(CACHE_VERSION)) {
          console.log('[SW] Removing old cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    );

    // حذف کش آیکون‌های قدیمی به صورت دستی
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    await Promise.all(
      keys.map((request) => {
        const url = new URL(request.url);
        // حذف آیکون‌های قدیمی که ممکن است با نام دیگر کش شده باشند
        if (url.pathname.includes('icon-') || 
            url.pathname.includes('apple-touch') ||
            (url.pathname.includes('ahrom') && !url.pathname.includes('pwa-icon'))) {
          console.log('[SW] Removing old icon cache:', url.pathname);
          return cache.delete(request);
        }
      })
    );

    // فعال‌سازی Navigation Preload برای بهبود سرعت
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }

    console.log('[SW] Service Worker activated with new PWA icons');
    await self.clients.claim();
  })());
});

// محدود کردن سایز کش Runtime
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems);
  }
}

// استراتژی Fetch: Network First + Runtime Caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط درخواست‌های خودی
  if (url.origin !== self.location.origin) {
    return;
  }

  // صفحات HTML: Network First با Runtime Cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith((async () => {
      try {
        // تلاش برای استفاده از پاسخ پیش‌لود شده توسط مرورگر
        const preloaded = await event.preloadResponse;
        if (preloaded) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, preloaded.clone());
          trimCache(RUNTIME_CACHE, MAX_RUNTIME_CACHE_SIZE);
          return preloaded;
        }

        const response = await fetch(request);
        if (response.status === 200) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
          // محدود کردن سایز کش
          trimCache(RUNTIME_CACHE, MAX_RUNTIME_CACHE_SIZE);
        }
        return response;
      } catch (err) {
        // اگر آنلاین نیست، از کش استفاده کن
        const cached = await caches.match(request);
        return cached || caches.match('/');
      }
    })());
    return;
  }

  // فایل‌های استاتیک (JS, CSS، فونت، تصاویر): Network Only برای جلوگیری از ناسازگاری نسخه‌ها
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'font') {
    event.respondWith(fetch(request));
    return;
  }

  // تصاویر: Stale-While-Revalidate سبک
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then(async (response) => {
          if (response.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
            trimCache(RUNTIME_CACHE, MAX_RUNTIME_CACHE_SIZE);
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // API و سایر درخواست‌ها: Network Only
  event.respondWith(fetch(request));
});
