import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const ZOOM_LEVELS = [0.5, 0.6, 0.7, 0.85, 1, 1.15, 1.3, 1.5] as const;
const DEFAULT_INDEX = 4; // 100%
const STORAGE_KEY = 'site-zoom-level';

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

  // Apply zoom to #root
  useEffect(() => {
    const zoomValue = ZOOM_LEVELS[zoomIndex];
    const root = document.documentElement;
    const appRoot = document.getElementById('root');

    root.style.setProperty('--app-zoom', String(zoomValue));
    root.style.removeProperty('zoom');
    document.body.style.removeProperty('zoom');

    if (appRoot) {
      if (zoomValue === 1) {
        appRoot.style.removeProperty('zoom');
      } else {
        appRoot.style.zoom = String(zoomValue);
      }
    }

    // Only persist on desktop
    if (isDesktop) {
      localStorage.setItem(STORAGE_KEY, String(zoomIndex));
    }

    return () => {
      root.style.removeProperty('--app-zoom');
      root.style.removeProperty('zoom');
      document.body.style.removeProperty('zoom');
      if (appRoot) appRoot.style.removeProperty('zoom');
    };
  }, [zoomIndex, isDesktop]);

  const zoomIn = useCallback(() => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomIndex(DEFAULT_INDEX);
  }, []);

  // Keyboard and mouse wheel events (desktop only)
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

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isDesktop, zoomIn, zoomOut, resetZoom]);

  return {
    zoomLevel: ZOOM_LEVELS[zoomIndex],
    zoomPercentage: Math.round(ZOOM_LEVELS[zoomIndex] * 100),
    isDesktop,
    isMobile,
    zoomIn,
    zoomOut,
    resetZoom
  };
};
