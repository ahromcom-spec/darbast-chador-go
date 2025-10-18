import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ثبت Service Worker برای PWA
if ('serviceWorker' in navigator) {
  // Register immediately (no 'load' wait) to speed up install on mobile
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('✅ Service Worker registered:', registration.scope);

      // Enable navigation preload for faster navigations if supported
      if ((registration as any).navigationPreload) {
        (registration as any).navigationPreload.enable().catch(() => {});
      }

      // بررسی بروزرسانی‌های جدید
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // نسخه جدید آماده است
              console.log('🔄 New version available! Reload to update.');
              registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    })
    .catch((error) => {
      console.error('❌ Service Worker registration failed:', error);
    });
}

createRoot(document.getElementById("root")!).render(<App />);
