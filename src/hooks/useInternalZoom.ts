import { useEffect, useState, useCallback } from 'react';

const ZOOM_LEVELS = [0.85, 1, 1.15] as const;
const STORAGE_KEY = 'site-zoom-level';

export const useInternalZoom = () => {
  const [zoomIndex, setZoomIndex] = useState(1); // Default to 100% (index 1)
  const [isWindows, setIsWindows] = useState(false);

  // Detect Windows OS
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isWin = userAgent.includes('windows');
    setIsWindows(isWin);

    // Load saved zoom level
    if (isWin) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const savedIndex = parseInt(saved, 10);
        if (savedIndex >= 0 && savedIndex < ZOOM_LEVELS.length) {
          setZoomIndex(savedIndex);
        }
      }
    }
  }, []);

  // Apply zoom to document
  useEffect(() => {
    if (!isWindows) return;

    const zoomValue = ZOOM_LEVELS[zoomIndex];
    const root = document.documentElement;
    
    // Use CSS zoom for Windows browsers (well supported in Chrome, Edge, Firefox)
    root.style.zoom = String(zoomValue);
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, String(zoomIndex));

    return () => {
      root.style.zoom = '';
    };
  }, [zoomIndex, isWindows]);

  const zoomIn = useCallback(() => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomIndex(1);
  }, []);

  // Handle keyboard and mouse wheel events
  useEffect(() => {
    if (!isWindows) return;

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
  }, [isWindows, zoomIn, zoomOut, resetZoom]);

  return {
    zoomLevel: ZOOM_LEVELS[zoomIndex],
    zoomPercentage: Math.round(ZOOM_LEVELS[zoomIndex] * 100),
    isWindows,
    zoomIn,
    zoomOut,
    resetZoom
  };
};
