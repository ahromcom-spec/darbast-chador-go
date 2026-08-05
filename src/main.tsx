import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { installOfflineFetchInterceptor } from "./lib/backup/offlineFetch";
import { installSyncListeners } from "./lib/backup/syncQueue";

// ✅ Import Leaflet CSS globally for all maps
import 'leaflet/dist/leaflet.css';

// نصب وقفه‌گیر آفلاین — درخواست‌های Supabase را در حالت آفلاین از بکاپ IndexedDB پاسخ می‌دهد
installOfflineFetchInterceptor();
// همگام‌سازی خودکار تغییرات آفلاین وقتی اینترنت وصل می‌شود
installSyncListeners();

// جلوگیری از زوم مرورگر (ویندوز/PWA) با Ctrl+Wheel / Ctrl +/-
// نکته: روی دسکتاپ نمی‌توان "Zoom" مرورگر را به‌صورت کامل کنترل کرد، اما می‌توان کلیدها/ژست‌های زوم را بلاک کرد.
(() => {
  try {
    // تنها listener غیرفعال‌سازی برای wheel — هم زوم مرورگر را بلاک می‌کند و هم
    // به زوم داخلی اپ سیگنال می‌دهد. این تکی بودن از پرش/لگ اسکرول جلوگیری می‌کند.
    window.addEventListener(
      'wheel',
      (e) => {
        if (!(e.ctrlKey || e.metaKey)) return; // اسکرول معمولی دست‌نخورده باقی می‌ماند
        e.preventDefault();
        // اطلاع به useInternalZoom (در صورت فعال بودن)
        try {
          window.dispatchEvent(
            new CustomEvent('app:zoom', { detail: e.deltaY < 0 ? 'in' : 'out' }),
          );
        } catch {}
      },
      { passive: false },
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



// ثبت Service Worker — فقط در production و خارج از iframe/preview تا با Lovable preview تداخل نداشته باشد
(() => {
  try {
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const host = window.location.hostname;
    const isPreview = host.includes('lovableproject.com') || host.includes('lovable.app') && host.includes('id-preview--');
    if (isInIframe || isPreview) {
      // پاک‌سازی هر SW قبلی در محیط preview
      navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => console.log('[SW] registered', reg.scope))
          .catch((err) => console.warn('[SW] registration failed', err));
      });
    }
  } catch (e) { console.warn('[SW] setup error', e); }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
