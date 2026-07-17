import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    NAJVA?: any;
    najva?: any;
  }
}

/**
 * After the Najva mini-script loads and the user is signed in,
 * grab the subscriber token and upsert it into `najva_subscriptions`
 * so the server can target this user via Najva.
 */
async function readNajvaToken(): Promise<string | null> {
  const candidates: Array<() => any> = [
    () => window.najva?.getSubscriberToken?.(),
    () => window.najva?.getSubscriberId?.(),
    () => window.najva?.subscriber_token,
    () => window.najva?.subscriberToken,
    () => window.najva?.token,
    () => window.NAJVA?.subscriber_token,
    () => window.NAJVA?.token,
    () => localStorage.getItem('najva_subscriber_token'),
    () => localStorage.getItem('najva-subscriber-token'),
  ];

  for (const get of candidates) {
    try {
      const v = await Promise.resolve(get());
      if (typeof v === 'string' && v.length > 8) return v;
    } catch {
      // ignore and try next
    }
  }
  return null;
}

export function useNajvaSubscription() {
  const { user } = useAuth();
  const savedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 60; // ~2 minutes total

    const tick = async () => {
      if (cancelled) return;
      attempts++;

      const token = await readNajvaToken();
      if (token && token !== savedRef.current) {
        savedRef.current = token;
        try {
          const deviceInfo = {
            user_agent: navigator.userAgent,
            platform: (navigator as any).userAgentData?.platform || navigator.platform,
            language: navigator.language,
          };
          const { error } = await supabase
            .from('najva_subscriptions')
            .upsert(
              {
                user_id: user.id,
                subscriber_token: token,
                device_info: deviceInfo,
              },
              { onConflict: 'user_id,subscriber_token' }
            );
          if (error) {
            // Fallback: try without conflict target (in case unique index differs)
            await supabase.from('najva_subscriptions').insert({
              user_id: user.id,
              subscriber_token: token,
              device_info: deviceInfo,
            });
          }
          console.log('[Najva] subscriber token saved');
        } catch (e) {
          console.warn('[Najva] failed to save token', e);
        }
        return; // done
      }

      if (attempts < maxAttempts) {
        setTimeout(tick, 2000);
      }
    };

    // give the mini-script a moment to bootstrap
    const timer = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.id]);
}
