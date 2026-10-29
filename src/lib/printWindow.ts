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

  popup.document.write(html);
  // about:blank must resolve logos against the app, not the blank document.
  const base = popup.document.createElement('base');
  base.href = window.location.href;
  popup.document.head.prepend(base);
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
      if (document.readyState !== 'complete') {
        await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
      }
      await Promise.all(Array.from(document.images).map(image => {
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
          // Restart images parsed before the popup acquired its base URL.
          const source = image.src;
          image.removeAttribute('src');
          image.src = source;
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