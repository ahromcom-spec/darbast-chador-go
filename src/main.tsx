import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";

// ✅ Import Leaflet CSS globally for all maps
import 'leaflet/dist/leaflet.css';

// جلوگیری از زوم مرورگر (ویندوز/PWA) با Ctrl+Wheel / Ctrl +/-
// نکته: روی دسکتاپ نمی‌توان "Zoom" مرورگر را به‌صورت کامل کنترل کرد، اما می‌توان کلیدها/ژست‌های زوم را بلاک کرد.
(() => {
  try {
    // Ctrl/Cmd + mouse wheel (trackpad pinch usually triggers ctrl+wheel)
    window.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
      },
      { passive: false }
    );

    // Ctrl/Cmd + (+/-/0)
    window.addEventListener(
      'keydown',
      (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const key = e.key;
        if (key === '+' || key === '-' || key === '=' || key === '0') {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // iOS Safari gesture events (safe no-op elsewhere)
    window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
    window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
    window.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);

  } catch {
    // no-op
  }
})();

// به‌روزرسانی چیدمان و تلاش برای آزاد کردن قفل چرخش (Android PWA/WebAPK)
(() => {
  try {
    const unlock = () => {
      const o = (screen as any)?.orientation;
      if (o && typeof o.unlock === 'function') {
        try { o.unlock(); } catch {}
      }
    };

    unlock();

    const onOrientationChange = () => {
      unlock();
      // بعضی WebView ها در چرخش، resize را درست ارسال نمی‌کنند
      setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
    };

    window.addEventListener('orientationchange', onOrientationChange);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) onOrientationChange();
    });
  } catch {
    // no-op
  }
})();

// ثبت Service Worker برای PWA و Push Notifications (بدون انتظار برای window.load)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('✅ Service Worker registered:', registration.scope);

      // به‌روزرسانی خودکار Service Worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Service Worker جدید آماده است
              console.log('📦 New Service Worker available');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    })
    .catch((error) => {
      console.error('❌ Service Worker registration failed:', error);
    });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
