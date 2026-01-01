export type RequestZoom100Options = {
  preserveScroll?: boolean;
};

const getCurrentZoom = (): number => {
  const root = document.documentElement;

  const fromVar = parseFloat(getComputedStyle(root).getPropertyValue('--app-zoom'));
  if (!Number.isNaN(fromVar) && fromVar > 0) return fromVar;

  const fromStyle = parseFloat(root.style.zoom || '');
  if (!Number.isNaN(fromStyle) && fromStyle > 0) return fromStyle;

  const fromBody = parseFloat(document.body.style.zoom || '');
  if (!Number.isNaN(fromBody) && fromBody > 0) return fromBody;

  return 1;
};

/**
 * Forces app zoom to 100% and keeps it there.
 * Also tries to preserve scroll position to avoid visible “jump”.
 */
export const requestZoom100 = (options: RequestZoom100Options = {}) => {
  if (typeof window === 'undefined') return;

  const { preserveScroll = true } = options;

  const currentZoom = getCurrentZoom();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  if (currentZoom !== 1) {
    // Apply 100% zoom immediately (removing zoom is equivalent to 1)
    document.documentElement.style.removeProperty('zoom');
    document.body.style.removeProperty('zoom');
    document.documentElement.style.setProperty('--app-zoom', '1');

    if (preserveScroll) {
      const scale = 1 / currentZoom;
      const nextX = Math.round(scrollX * scale);
      const nextY = Math.round(scrollY * scale);
      requestAnimationFrame(() => window.scrollTo(nextX, nextY));
    }
  }

  // Ask the internal zoom hook to persist 100% (so UI + localStorage match).
  window.dispatchEvent(new Event('app:force-zoom-100'));
};
