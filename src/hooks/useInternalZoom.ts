import { useEffect, useState, useCallback } from 'react';

const ZOOM_LEVELS = [0.5, 0.6, 0.7, 0.85, 1, 1.15, 1.3, 1.5] as const;
const STORAGE_KEY = 'site-zoom-level';

export const useInternalZoom = () => {
  const [zoomIndex, setZoomIndex] = useState(4); // Default to 100% (index 4)
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop environment (Windows, macOS, Linux, or mobile "Desktop site" mode)
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const desktop =
      ua.includes('windows') ||
      ua.includes('macintosh') ||
      ua.includes('linux x86') ||
      ua.includes('cros') ||
      // "Desktop site" on mobile Chrome often sets a desktop UA or renders wide viewport
      (window.innerWidth >= 980 && !ua.includes('mobile'));
    setIsDesktop(desktop);

    // Load saved zoom level
    if (desktop) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const savedIndex = parseInt(saved, 10);
        if (savedIndex >= 0 && savedIndex < ZOOM_LEVELS.length) {
          setZoomIndex(savedIndex);
        }
      }
    }
  }, []);

  // Apply zoom to document using CSS transform instead of CSS zoom for better dropdown positioning
  useEffect(() => {
    if (!isDesktop) return;

    const zoomValue = ZOOM_LEVELS[zoomIndex];
    const root = document.documentElement;
    
    // Store zoom value as a CSS variable for JavaScript access
    root.style.setProperty('--app-zoom', String(zoomValue));
    
    // Only apply CSS zoom when NOT 1 (100%)
    // When zoom is 1, remove it completely to avoid any positioning issues
    if (zoomValue === 1) {
      root.style.removeProperty('zoom');
      document.body.style.removeProperty('zoom');
    } else {
      root.style.zoom = String(zoomValue);
      document.body.style.zoom = String(zoomValue);
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, String(zoomIndex));

    return () => {
      root.style.removeProperty('zoom');
      root.style.removeProperty('--app-zoom');
      document.body.style.removeProperty('zoom');
    };
  }, [zoomIndex, isDesktop]);

  const zoomIn = useCallback(() => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomIndex(4);
  }, []);

  // Allow dropdowns/popovers to permanently force 100% zoom (Windows only)
  useEffect(() => {
    if (!isDesktop) return;

    const handleForceZoom100 = () => {
      setZoomIndex((prev) => (prev === 4 ? prev : 4));
    };

    window.addEventListener('app:force-zoom-100', handleForceZoom100);
    return () => window.removeEventListener('app:force-zoom-100', handleForceZoom100);
  }, [isDesktop]);

  // Handle keyboard and mouse wheel events
  useEffect(() => {
    if (!isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;

      // Ctrl + Plus or Ctrl + NumpadAdd or Ctrl + =
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomIn();
        return;
      }

      // Ctrl + Minus or Ctrl + NumpadSubtract
      if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOut();
        return;
      }

      // Ctrl + 0 or Ctrl + Numpad0 (reset)
      if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        resetZoom();
        return;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;

      e.preventDefault();
      
      if (e.deltaY < 0) {
        // Scroll up = zoom in
        zoomIn();
      } else if (e.deltaY > 0) {
        // Scroll down = zoom out
        zoomOut();
      }
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
    zoomIn,
    zoomOut,
    resetZoom
  };
};
