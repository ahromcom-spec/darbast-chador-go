
const CACHE_VERSION = 'ahrom-v31-offline-shell';
const CACHE_NAME = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// فایل‌های ضروری برای نصب اولیه (App Shell)
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest?v=13',
  '/manifest.json?v=13',
  '/icons/icon-192-v3.png?v=10',
  '/icons/icon-512-v3.png?v=10',
  '/icons/maskable-512-v3.png?v=10',
  '/ahrom-pwa-icon.png',
  '/ahrom-pwa-icon-new.png',
  '/ahrom-app-icon.png',
  '/ahrom-logo.png',
  '/ahrom-logo-original.png'
];


// حداکثر تعداد آیتم‌ها در کش Runtime
const MAX_RUNTIME_CACHE_SIZE = 1200;

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

    console.log('[SW] Service Worker activated with Push Notification support');
    await self.clients.claim();
  })());
});

// ==================== PUSH NOTIFICATIONS ====================

// به‌روزرسانی App Badge روی آیکون برنامه
async function updateAppBadge() {
  try {
    // دریافت تعداد اعلان‌های خوانده‌نشده از سرور
    const response = await fetch('/api/unread-count');
    if (response.ok) {
      const { count } = await response.json();
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          await navigator.setAppBadge(count);
        } else {
          await navigator.clearAppBadge();
        }
      }
    }
  } catch (error) {
    console.log('[SW] Badge update error:', error);
  }
}

// افزایش Badge به صورت محلی
async function incrementBadge() {
  try {
    if ('setAppBadge' in navigator) {
      // ارسال پیام به کلاینت برای به‌روزرسانی badge
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length > 0) {
        clients.forEach(client => {
          client.postMessage({ type: 'INCREMENT_BADGE' });
        });
      } else {
        // اگر کلاینتی باز نیست، فقط یک badge نشان بده
        await navigator.setAppBadge(1);
      }
    }
  } catch (error) {
    console.log('[SW] Badge increment error:', error);
  }
}

// دریافت Push Notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'اعلان جدید',
    body: 'شما یک اعلان جدید دارید',
    link: '/',
    type: 'info'
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  // انتخاب آیکون بر اساس نوع اعلان
  let icon = '/ahrom-pwa-icon.png';
  let badge = '/ahrom-app-icon.png';

  // تنظیمات خاص برای تماس ورودی
  const isIncomingCall = data.type === 'incoming-call';
  
  const options = {
    body: data.body,
    icon: icon,
    badge: badge,
    // الگوی لرزش مخصوص تماس ورودی (مثل زنگ تلفن)
    vibrate: isIncomingCall 
      ? [500, 200, 500, 200, 500, 200, 500, 200, 500] // لرزش طولانی‌تر و تکرار شونده برای تماس
      : [200, 100, 200],
    dir: 'rtl',
    lang: 'fa',
    tag: isIncomingCall 
      ? `ahrom-call-${data.callData?.orderId || Date.now()}` // تگ یکتا برای هر تماس
      : `ahrom-${data.type || 'notification'}-${Date.now()}`,
    renotify: true,
    // تماس ورودی باید تا پاسخ/رد کاربر بماند
    requireInteraction: isIncomingCall || data.type === 'error' || data.type === 'warning',
    // صدای پیش‌فرض سیستم
    silent: false,
    data: {
      link: data.link || '/',
      type: data.type,
      timestamp: data.timestamp || new Date().toISOString(),
      callData: data.callData || null
    },
    // دکمه‌های مخصوص تماس ورودی
    actions: isIncomingCall 
      ? [
          {
            action: 'answer',
            title: '📞 پاسخ'
          },
          {
            action: 'reject',
            title: '❌ رد تماس'
          }
        ]
      : [
          {
            action: 'open',
            title: 'مشاهده'
          },
          {
            action: 'dismiss',
            title: 'بستن'
          }
        ]
  };

  event.waitUntil(
    (async () => {
      // نمایش نوتیفیکیشن
      await self.registration.showNotification(data.title, options);
      
      // به‌روزرسانی App Badge
      await incrementBadge();
    })()
  );
});

// کلیک روی نوتیفیکیشن
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  const notificationData = event.notification.data;
  const isIncomingCall = notificationData?.type === 'incoming-call';
  
  event.notification.close();

  // اگر روی دکمه بستن یا رد تماس کلیک شد
  if (event.action === 'dismiss' || event.action === 'reject') {
    console.log('[SW] Call rejected or notification dismissed');
    return;
  }

  // لینک برای باز کردن
  const link = notificationData?.link || '/';
  const urlToOpen = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // اگر پنجره‌ای از اپلیکیشن باز است، آن را فوکوس کن
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            // اگر تماس ورودی است، پیام به کلاینت بفرست
            if (isIncomingCall && event.action === 'answer') {
              client.postMessage({
                type: 'INCOMING_CALL_ANSWERED',
                callData: notificationData.callData
              });
            }
            return client.navigate(urlToOpen).then(() => client.focus());
          }
        }
        // اگر هیچ پنجره‌ای باز نیست، یکی باز کن
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// بستن نوتیفیکیشن
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// ==================== CACHING ====================

const OFFLINE_DB_NAME = 'ahrom-offline-backup';
const OFFLINE_DB_VERSION = 3;
const OFFLINE_TABLES_STORE = 'tables';
const OFFLINE_TABLE_ROWS_STORE = 'table_rows';
const OFFLINE_TABLE_INFO_STORE = 'table_info';
const OFFLINE_MEDIA_STORE = 'media';
const OFFLINE_META_STORE = 'meta';
const OFFLINE_QUEUE_STORE = 'pending_mutations';

let offlineDbPromise = null;

function openOfflineDb() {
  if (offlineDbPromise) return offlineDbPromise;
  offlineDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_TABLES_STORE)) {
        db.createObjectStore(OFFLINE_TABLES_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_TABLE_ROWS_STORE)) {
        db.createObjectStore(OFFLINE_TABLE_ROWS_STORE, { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_TABLE_INFO_STORE)) {
        db.createObjectStore(OFFLINE_TABLE_INFO_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_MEDIA_STORE)) {
        db.createObjectStore(OFFLINE_MEDIA_STORE, { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_META_STORE)) {
        db.createObjectStore(OFFLINE_META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      offlineDbPromise = null;
      reject(req.error);
    };
  });
  return offlineDbPromise;
}

async function getOfflineMedia(path) {
  try {
    const db = await openOfflineDb();
    const tx = db.transaction(OFFLINE_MEDIA_STORE, 'readonly');
    const req = tx.objectStore(OFFLINE_MEDIA_STORE).get(path);
    return await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function parseStorageMediaKey(url) {
  const match = url.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public\/|authenticated\/|sign\/)?([^/]+)\/(.+)$/);
  if (!match) return null;
  return `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`;
}

function offlineMediaResponse(record) {
  return new Response(record.blob, {
    status: 200,
    headers: {
      'Content-Type': record.mimeType || record.blob?.type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'X-Offline-Cache': 'ahrom-backup-media'
    }
  });
}

// محدود کردن سایز کش Runtime
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems);
  }
}

// میزبان‌های مجاز برای کش cross-origin (تایل نقشه، آیکن‌های Leaflet، برچسب‌ها)
const CROSS_ORIGIN_TILE_HOSTS = [
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'server.arcgisonline.com',
  'basemaps.cartocdn.com',
  'a.basemaps.cartocdn.com',
  'b.basemaps.cartocdn.com',
  'c.basemaps.cartocdn.com',
  'd.basemaps.cartocdn.com',
  'unpkg.com',
];

function isCacheableCrossOrigin(url) {
  if (CROSS_ORIGIN_TILE_HOSTS.includes(url.hostname)) return true;
  // زیرمجموعه cartocdn را نیز پوشش بده
  if (url.hostname.endsWith('.basemaps.cartocdn.com')) return true;
  return false;
}

// استراتژی Fetch: Network First + Runtime Caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // رسانه‌های Storage که هنگام بارگذاری بکاپ یا نصب آفلاین داخل IndexedDB ذخیره شده‌اند.
  // این بخش برای <img>/<video> ضروری است، چون این درخواست‌ها مستقیماً توسط مرورگر
  // اجرا می‌شوند و همیشه از fetch interceptor داخل صفحه عبور نمی‌کنند.
  const offlineMediaKey = parseStorageMediaKey(url);
  if (request.method === 'GET' && offlineMediaKey) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) return response;
      } catch {
        // offline fallback below
      }
      const cachedMedia = await getOfflineMedia(offlineMediaKey);
      if (cachedMedia?.blob) return offlineMediaResponse(cachedMedia);
      return new Response(null, {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'X-Offline-Cache': 'ahrom-backup-media-miss'
        }
      });
    })());
    return;
  }

  // درخواست‌های cross-origin مربوط به تایل نقشه و آیکن‌های Leaflet را با
  // Stale-While-Revalidate کش می‌کنیم تا نقشه در حالت آفلاین قابل استفاده باشد.
  if (url.origin !== self.location.origin) {
    if (request.method === 'GET' && isCacheableCrossOrigin(url)) {
      event.respondWith((async () => {
        const cached = await caches.match(request);
        const fetchPromise = fetch(request, { mode: 'cors', credentials: 'omit' })
          .then(async (response) => {
            // opaque پاسخ‌ها (بدون CORS) هم قابل کش شدن هستند
            if (response && (response.status === 200 || response.type === 'opaque')) {
              try {
                const cache = await caches.open(RUNTIME_CACHE);
                cache.put(request, response.clone());
                trimCache(RUNTIME_CACHE, MAX_RUNTIME_CACHE_SIZE);
              } catch {}
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })());
      return;
    }
    // سایر cross-origin ها را دست‌نخورده رها کن
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
          trimCache(RUNTIME_CACHE, MAX_RUNTIME_CACHE_SIZE);
        }
        return response;
      } catch (err) {
        // آفلاین: ابتدا تطبیق دقیق، سپس بدون توجه به query string، در نهایت fallback به /
        const cached =
          (await caches.match(request)) ||
          (await caches.match(request, { ignoreSearch: true })) ||
          (await caches.match('/index.html')) ||
          (await caches.match('/'));
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:sans-serif;padding:2rem;direction:rtl">آفلاین هستید و نسخه‌ی کش‌شده‌ای از این صفحه موجود نیست.</body>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // فایل‌های استاتیک (JS, CSS، فونت): Stale-While-Revalidate تا آفلاین کار کند
  if (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font') {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const fetchPromise = fetch(request).then(async (response) => {
        if (response && response.status === 200) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
          trimCache(RUNTIME_CACHE, MAX_RUNTIME_CACHE_SIZE);
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }

  // تصاویر: Stale-While-Revalidate
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
