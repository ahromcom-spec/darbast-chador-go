/** Keep native printing in the disposable document, not the app's event loop. */
export function openPrintWindow(html: string, onStarted?: () => void): Window | null {
  const popup = window.open('', '_blank');
  if (!popup) return null;

  let started = false;
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('focus', onReturn);
    popup.removeEventListener('beforeprint', onBeforePrint);
    popup.removeEventListener('afterprint', cleanup);
    popup.removeEventListener('pagehide', cleanup);
    if (!popup.closed) popup.close();
    window.focus();
  };
  const onReturn = () => {
    // Do not close while fonts/images are loading, or while native print is open.
    if (started) cleanup();
  };
  const onBeforePrint = () => {
    if (started) return;
    started = true;
    onStarted?.();
  };

  // Resolve image URLs before parsing; about:blank has no reliable base URL.
  const printableHtml = html.replace(/\bsrc="([^"]+)"/g, (attribute, source: string) => {
    try { return `src="${new URL(source, window.location.href).href.replace(/"/g, '&quot;')}"`; }
    catch { return attribute; }
  });
  popup.document.write(printableHtml);
  popup.document.close();
  popup.addEventListener('beforeprint', onBeforePrint);
  popup.addEventListener('afterprint', cleanup);
  popup.addEventListener('pagehide', cleanup);
  window.addEventListener('focus', onReturn);

  // This script executes in the print tab. A blocking native print() call must
  // never remain on the application's JavaScript call stack (notably in Edge).
  const script = popup.document.createElement('script');
  script.textContent = `
    (async function () {
      await Promise.all(Array.from(document.images).map(image => {
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));
      if (document.fonts) await document.fonts.ready;
      if (window.closed) return;
      window.focus();
      setTimeout(() => {
        try { window.print(); }
        catch (error) { window.close(); }
      }, 300);
    })();
  `;
  popup.document.body.appendChild(script);
  return popup;
}