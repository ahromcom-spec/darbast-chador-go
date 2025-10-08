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
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).__deferredPrompt = e; // keep globally to avoid early event loss
      setDeferred(e);
      setCanInstall(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      (window as any).__deferredPrompt = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const promptEvent = deferred || (window as any).__deferredPrompt;
    if (!promptEvent) return { outcome: 'dismissed' } as const;

    promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    (window as any).__deferredPrompt = null;
    setDeferred(null);
    setCanInstall(false);
    return choiceResult as { outcome: 'accepted' | 'dismissed' };
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
