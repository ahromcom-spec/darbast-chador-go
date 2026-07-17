import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// 100% اکنون معادل ۵۰٪ قبلی است تا نمای پیش‌فرض دورتر و طبیعی‌تر باشد
const ZOOM_LEVELS = [0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.85, 1] as const;
const DEFAULT_INDEX = 4; // 100% (که معادل ۵۰٪ قبلی است)
const STORAGE_KEY = 'site-zoom-level-v2';

export const useInternalZoom = () => {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_INDEX);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Detect environment
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const desktop =
      ua.includes('windows') ||
      ua.includes('macintosh') ||
      ua.includes('linux x86') ||
      ua.includes('cros') ||
      (window.innerWidth >= 980 && !ua.includes('mobile'));
    setIsDesktop(desktop);
    setIsMobile(!desktop);

    // Only restore saved zoom on desktop
    if (desktop) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const savedIndex = parseInt(saved, 10);
        if (savedIndex >= 0 && savedIndex < ZOOM_LEVELS.length) {
          setZoomIndex(savedIndex);
        }
      }
    }
    // On mobile, always start at 100% (default) — no restore from storage
  }, []);

  // Reset zoom to 100% on route change (mobile only)
  useEffect(() => {
    if (!isMobile) return;
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setZoomIndex(DEFAULT_INDEX);
    }
  }, [location.pathname, isMobile]);

  // Apply zoom to #root and keep body unzoomed. Body zoom breaks fixed panels
  // and Radix/Floating UI positioning in Chrome because portal coordinates get scaled.
  useEffect(() => {
    // روی موبایل هرگز zoom اعمال نشود — همیشه ۱۰۰٪ واقعی
    const zoomValue = isMobile ? 1 : ZOOM_LEVELS[zoomIndex];
    const root = document.documentElement;
    const appRoot = document.getElementById('root');

    root.style.setProperty('--app-zoom', String(zoomValue));
    root.style.removeProperty('zoom');

    document.body.style.removeProperty('zoom');

    if (appRoot) {
      appRoot.style.removeProperty('width');
      appRoot.style.removeProperty('min-height');
      if (zoomValue === 1) {
        appRoot.style.removeProperty('zoom');
      } else {
        appRoot.style.zoom = String(zoomValue);
      }
    }
    // روی دسکتاپ، اسکرول افقی ناشی از گرد شدن zoom را مخفی می‌کنیم؛ روی موبایل
    // هیچ محور اسکرولی را قفل نمی‌کنیم تا کشیدن انگشت در ماژول‌ها آزاد بماند.
    if (isDesktop) {
      document.documentElement.style.overflowX = 'hidden';
      document.body.style.overflowX = 'hidden';
    } else {
      document.documentElement.style.overflowX = 'auto';
      document.body.style.overflowX = 'auto';
      document.documentElement.style.overflowY = 'auto';
      document.body.style.overflowY = 'auto';
    }

    // Only persist on desktop
    if (isDesktop) {
      localStorage.setItem(STORAGE_KEY, String(zoomIndex));
    }

    return () => {
      root.style.removeProperty('--app-zoom');
      root.style.removeProperty('zoom');
      document.documentElement.style.removeProperty('overflow-x');
      document.documentElement.style.removeProperty('overflow-y');
      document.body.style.removeProperty('zoom');
      document.body.style.removeProperty('overflow-x');
      document.body.style.removeProperty('overflow-y');
      if (appRoot) {
        appRoot.style.removeProperty('zoom');
        appRoot.style.removeProperty('width');
        appRoot.style.removeProperty('min-height');
      }
    };
  }, [zoomIndex, isDesktop, isMobile]);


  const zoomIn = useCallback(() => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomIndex(DEFAULT_INDEX);
  }, []);

  // Keyboard zoom shortcuts (desktop only). Wheel zoom is intentionally NOT bound
  // here to avoid duplicate non-passive wheel listeners that degrade scroll smoothness.
  useEffect(() => {
    if (!isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        resetZoom();
        return;
      }
    };

    // Listen to a custom event dispatched by the single global wheel handler in main.tsx
    const handleAppZoom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'in') zoomIn();
      else if (detail === 'out') zoomOut();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:zoom', handleAppZoom as EventListener);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:zoom', handleAppZoom as EventListener);
    };
  }, [isDesktop, zoomIn, zoomOut, resetZoom]);


  return {
    zoomLevel: ZOOM_LEVELS[zoomIndex],
    // درصد نمایشی بر اساس فاصله از پیش‌فرض محاسبه می‌شود تا حالت پیش‌فرض = ۱۰۰٪ باشد
    zoomPercentage: Math.round((ZOOM_LEVELS[zoomIndex] / ZOOM_LEVELS[DEFAULT_INDEX]) * 100),
    isDesktop,
    isMobile,
    zoomIn,
    zoomOut,
    resetZoom
  };
};
