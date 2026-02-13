/**
 * Gets the current CSS zoom level from the app.
 * Zoom is applied to #root element.
 */
export const getCurrentZoom = (): number => {
  const appRoot = document.getElementById('root');
  if (appRoot) {
    const fromStyle = parseFloat(appRoot.style.zoom || '');
    if (!Number.isNaN(fromStyle) && fromStyle > 0) return fromStyle;
  }

  const fromVar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-zoom'));
  if (!Number.isNaN(fromVar) && fromVar > 0) return fromVar;

  return 1;
};
