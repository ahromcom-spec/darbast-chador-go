import { useEffect, useState, useCallback } from 'react';

const ZOOM_LEVELS = [0.75, 0.9, 1.05] as const;
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
    const body = document.body;

    // Use CSS zoom for Windows browsers (well supported in Chrome, Edge)
    root.style.zoom = String(zoomValue);
    if (body) body.style.zoom = String(zoomValue);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, String(zoomIndex));

    return () => {
      root.style.zoom = '';
      if (body) body.style.zoom = '';
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

  // Listen for dropdown/popover/select open events and reset zoom to 100%
  useEffect(() => {
    if (!isWindows) return;

    // MutationObserver to detect when Radix UI popovers/dropdowns are added to DOM
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              // Check for Radix UI components (Select, Dropdown, Popover, Command, etc.)
              const isRadixPortal = 
                node.hasAttribute('data-radix-popper-content-wrapper') ||
                node.hasAttribute('data-radix-select-viewport') ||
                node.querySelector('[data-radix-popper-content-wrapper]') ||
                node.querySelector('[role="listbox"]') ||
                node.querySelector('[role="menu"]') ||
                node.querySelector('[data-radix-menu-content]') ||
                node.querySelector('[data-radix-select-content]') ||
                node.querySelector('[data-radix-popover-content]') ||
                node.querySelector('[data-radix-dropdown-menu-content]') ||
                node.classList.contains('SelectContent') ||
                node.getAttribute('data-state') === 'open';
              
              if (isRadixPortal) {
                // Reset zoom to 100% when dropdown opens
                setZoomIndex(1);
                return;
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state']
    });

    // Also listen for focus on select elements
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.getAttribute('role') === 'combobox' ||
        target.getAttribute('role') === 'listbox' ||
        target.closest('[role="combobox"]') ||
        target.closest('[data-radix-select-trigger]') ||
        target.closest('[data-radix-dropdown-menu-trigger]')
      ) {
        setZoomIndex(1);
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isWindows]);

  return {
    zoomLevel: ZOOM_LEVELS[zoomIndex],
    zoomPercentage: Math.round(ZOOM_LEVELS[zoomIndex] * 100),
    isWindows,
    zoomIn,
    zoomOut,
    resetZoom
  };
};
