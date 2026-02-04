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

// ثبت Service Worker برای PWA/Push:
// توجه: نجوا (Najva) سرویس‌ورکر خودش را مدیریت می‌کند.
// ثبت یک سرویس‌ورکر سفارشی در scope «/» (مثل /sw.js) می‌تواند با نجوا تداخل ایجاد کند
// و باعث شود فرآیند subscribe و دریافت subscriberId انجام نشود.
// بنابراین اینجا سرویس‌ورکر سفارشی ثبت نمی‌کنیم.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
