import { useEffect, useState, useCallback } from 'react';

// Simple, focused hook to manage PWA install flow across browsers
export function usePWAInstall() {
  const [deferred, setDeferred] = useState<any>(() => (window as any).__deferredPrompt || null);
  const [canInstall, setCanInstall] = useState<boolean>(Boolean((window as any).__deferredPrompt));
  const [installed, setInstalled] = useState<boolean>(false);

  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as any).standalone === true
  );

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    // If early-captured event exists (from index.html), use it
    if ((window as any).__deferredPrompt && !deferred) {
      setDeferred((window as any).__deferredPrompt);
      setCanInstall(true);
    }

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).__deferredPrompt = e; // keep globally to avoid early event loss
      setDeferred(e);
      setCanInstall(true);
      try { console.debug('PWA: beforeinstallprompt fired'); } catch {}
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      (window as any).__deferredPrompt = null;
      setCanInstall(false);
      try { console.debug('PWA: appinstalled'); } catch {}
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [deferred]);

  const promptInstall = useCallback(async () => {
    const promptEvent = deferred || (window as any).__deferredPrompt;
    if (!promptEvent || typeof promptEvent.prompt !== 'function') {
      try { console.debug('PWA: no deferred prompt available'); } catch {}
      return { outcome: 'dismissed' } as const;
    }
    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      (window as any).__deferredPrompt = null;
      setDeferred(null);
      setCanInstall(false);
      try { console.debug('PWA: user choice', choiceResult); } catch {}
      return choiceResult as { outcome: 'accepted' | 'dismissed' };
    } catch (err) {
      try { console.error('PWA: prompt failed', err); } catch {}
      return { outcome: 'dismissed' } as const;
    }
  }, [deferred]);

  return {
    canInstall,
    isStandalone,
    isIOS,
    installed,
    promptInstall,
  } as const;
}

export default usePWAInstall;
