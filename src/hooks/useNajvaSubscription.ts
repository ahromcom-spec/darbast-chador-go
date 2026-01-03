import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

declare global {
  interface Window {
    najva?: {
      getSubscriberId: () => Promise<string | null>;
      subscribeUser: () => Promise<void>;
      isSubscribed: () => Promise<boolean>;
    };
  }
}

// =====================
// Debug helper: logs to console with timestamp
// =====================
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) {
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[Najva ${ts}]`, ...args);
  }
};

export const useNajvaSubscription = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriberId, setSubscriberId] = useState<string | null>(null);

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // =====================
  // Wait for window.najva to become available
  // =====================
  const waitForNajva = async (timeoutMs = 10000) => {
    log('⏳ Waiting for window.najva SDK...');
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.najva) {
        log('✅ window.najva is available');
        return true;
      }
      await sleep(300);
    }
    log('❌ window.najva not available after', timeoutMs, 'ms');
    return false;
  };

  // =====================
  // Safe call to getSubscriberId
  // =====================
  const getSubscriberIdSafe = async (): Promise<string | null> => {
    try {
      if (!window.najva) {
        log('getSubscriberIdSafe: window.najva undefined');
        return null;
      }
      if (typeof window.najva.getSubscriberId !== 'function') {
        log('getSubscriberIdSafe: getSubscriberId is not a function');
        return null;
      }
      const maybe = await window.najva.getSubscriberId();
      log('getSubscriberIdSafe result:', maybe);
      return typeof maybe === 'string' && maybe.trim() ? maybe : null;
    } catch (err) {
      log('getSubscriberIdSafe error:', err);
      return null;
    }
  };

  // =====================
  // Poll until subscriberId becomes available
  // =====================
  const pollSubscriberId = async (timeoutMs = 12000) => {
    log('⏳ Polling for subscriberId...');
    const start = Date.now();
    let attempts = 0;
    while (Date.now() - start < timeoutMs) {
      attempts++;
      const subId = await getSubscriberIdSafe();
      if (subId) {
        log('✅ Got subscriberId after', attempts, 'attempts:', subId);
        return subId;
      }
      await sleep(600);
    }
    log('❌ subscriberId not available after', attempts, 'attempts');
    return null;
  };

  // =====================
  // Check if subscription exists in DB
  // =====================
  const checkSubscription = useCallback(async () => {
    if (!user) {
      log('checkSubscription: no user');
      setIsLoading(false);
      return;
    }

    log('🔍 Checking DB for existing subscription...');
    try {
      const { data, error } = await supabase
        .from('najva_subscriptions')
        .select('subscriber_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        log('DB query error:', error);
      }

      if (data?.subscriber_token) {
        log('✅ Found existing subscription in DB:', data.subscriber_token.slice(0, 12) + '...');
        setIsSubscribed(true);
        setSubscriberId(data.subscriber_token);
      } else {
        log('ℹ️ No subscription found in DB for user');
      }
    } catch (error) {
      log('checkSubscription error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // =====================
  // Save token to DB
  // =====================
  const saveSubscription = useCallback(async (token: string) => {
    if (!user) {
      log('saveSubscription: no user');
      return false;
    }

    log('💾 Saving subscription token to DB...');
    try {
      const { data: existing, error: checkError } = await supabase
        .from('najva_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
        log('Check existing error:', checkError);
      }

      if (existing) {
        log('Updating existing record...');
        const { error } = await supabase
          .from('najva_subscriptions')
          .update({
            subscriber_token: token,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) {
          log('❌ Update error:', error);
          throw error;
        }
      } else {
        log('Creating new record...');
        const { error } = await supabase
          .from('najva_subscriptions')
          .insert({
            user_id: user.id,
            subscriber_token: token,
            device_info: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
            },
          });

        if (error) {
          log('❌ Insert error:', error);
          throw error;
        }
      }

      setIsSubscribed(true);
      setSubscriberId(token);
      log('✅ Subscription saved successfully!');
      return true;
    } catch (error) {
      log('saveSubscription error:', error);
      return false;
    }
  }, [user]);

  // =====================
  // Subscribe user to Najva
  // =====================
  const subscribe = useCallback(async () => {
    log('========== SUBSCRIBE START ==========');
    log('User:', user?.id ?? 'null');

    if (!user) {
      log('❌ No user - cannot subscribe');
      return false;
    }

    try {
      // Step 1: Wait for SDK
      const loaded = await waitForNajva(10000);
      if (!loaded) {
        log('❌ SDK not loaded - aborting');
        return false;
      }

      // Step 2: Check browser Notification permission
      log('📝 Current Notification.permission:', Notification.permission);
      if (Notification.permission === 'denied') {
        log('❌ Notification permission is DENIED. User must change in browser settings.');
        return false;
      }

      // Step 3: Request permission if not granted
      if (Notification.permission !== 'granted') {
        log('🔔 Requesting notification permission...');
        const permission = await Notification.requestPermission();
        log('Permission result:', permission);
        if (permission !== 'granted') {
          log('❌ Permission not granted');
          return false;
        }
      }

      // Step 4: Check if already subscribed
      log('🔍 Checking if already has subscriberId...');
      let subId = await getSubscriberIdSafe();
      if (subId) {
        log('✅ Already have subscriberId:', subId);
        const saved = await saveSubscription(subId);
        log('========== SUBSCRIBE END (existing) ==========');
        return saved;
      }

      // Step 5: Call subscribeUser
      log('📞 Calling window.najva.subscribeUser()...');
      try {
        await window.najva!.subscribeUser();
        log('subscribeUser() completed');
      } catch (subErr) {
        log('subscribeUser() threw error:', subErr);
      }

      // Step 6: Poll for subscriberId
      subId = await pollSubscriberId(12000);
      if (subId) {
        log('✅ Got subscriberId:', subId);
        const saved = await saveSubscription(subId);
        log('========== SUBSCRIBE END (success) ==========');
        return saved;
      }

      log('❌ Could not get subscriberId after subscribeUser');
      log('========== SUBSCRIBE END (failed) ==========');
      return false;
    } catch (error) {
      log('❌ Subscribe error:', error);
      log('========== SUBSCRIBE END (error) ==========');
      return false;
    }
  }, [user, saveSubscription]);

  // =====================
  // Unsubscribe
  // =====================
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    log('🗑️ Unsubscribing...');
    try {
      const { error } = await supabase
        .from('najva_subscriptions')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        log('Unsubscribe error:', error);
        throw error;
      }

      setIsSubscribed(false);
      setSubscriberId(null);
      log('✅ Unsubscribed');
      return true;
    } catch (error) {
      log('unsubscribe error:', error);
      return false;
    }
  }, [user]);

  // =====================
  // Auto-save if already subscribed (on page load)
  // =====================
  useEffect(() => {
    const autoSaveSubscription = async () => {
      if (!user || isSubscribed) return;

      log('🔄 Auto-save check starting...');
      const loaded = await waitForNajva(5000);
      if (!loaded) {
        log('Auto-save: SDK not loaded');
        return;
      }

      const subId = await getSubscriberIdSafe();
      if (subId) {
        log('🔄 Auto-saving existing subscription:', subId);
        await saveSubscription(subId);
      } else {
        log('Auto-save: no existing subscriberId');
      }
    };

    // Delay to ensure SDK is loaded
    const timer = setTimeout(autoSaveSubscription, 3000);
    return () => clearTimeout(timer);
  }, [user, isSubscribed, saveSubscription]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    isSubscribed,
    isLoading,
    subscriberId,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
};

