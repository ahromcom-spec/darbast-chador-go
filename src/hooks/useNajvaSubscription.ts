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

export const useNajvaSubscription = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriberId, setSubscriberId] = useState<string | null>(null);

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const waitForNajva = async (timeoutMs = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.najva) return true;
      await sleep(250);
    }
    return false;
  };

  const getSubscriberIdSafe = async () => {
    try {
      const maybe = await Promise.resolve(window.najva?.getSubscriberId?.());
      return typeof maybe === 'string' && maybe.trim() ? maybe : null;
    } catch {
      return null;
    }
  };

  const pollSubscriberId = async (timeoutMs = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const subId = await getSubscriberIdSafe();
      if (subId) return subId;
      await sleep(500);
    }
    return null;
  };

  // بررسی وضعیت اشتراک فعلی
  const checkSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // بررسی اینکه آیا توکن نجوا در دیتابیس ذخیره شده
      const { data } = await supabase
        .from('najva_subscriptions')
        .select('subscriber_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.subscriber_token) {
        setIsSubscribed(true);
        setSubscriberId(data.subscriber_token);
      }
    } catch (error) {
      console.error('[Najva] Error checking subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ذخیره توکن نجوا در دیتابیس
  const saveSubscription = useCallback(async (token: string) => {
    if (!user) return false;

    try {
      // بررسی آیا قبلاً وجود دارد
      const { data: existing } = await supabase
        .from('najva_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // به‌روزرسانی
        const { error } = await supabase
          .from('najva_subscriptions')
          .update({ 
            subscriber_token: token,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // ایجاد جدید
        const { error } = await supabase
          .from('najva_subscriptions')
          .insert({
            user_id: user.id,
            subscriber_token: token,
            device_info: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language
            }
          });

        if (error) throw error;
      }

      setIsSubscribed(true);
      setSubscriberId(token);
      console.log('[Najva] Subscription saved successfully');
      return true;
    } catch (error) {
      console.error('[Najva] Error saving subscription:', error);
      return false;
    }
  }, [user]);

  // ثبت کاربر در نجوا
  const subscribe = useCallback(async () => {
    if (!user) {
      console.log('[Najva] User not logged in');
      return false;
    }

    try {
      // منتظر لود شدن SDK
      const loaded = await waitForNajva(8000);
      if (!loaded) {
        console.log('[Najva] SDK not loaded (timeout)');
        return false;
      }

      // درخواست اجازه نوتیفیکیشن
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[Najva] Notification permission denied');
        return false;
      }

      // ثبت کاربر در نجوا
      await window.najva!.subscribeUser();

      // گاهی subId با تاخیر آماده می‌شود، پس Poll می‌کنیم
      const subId = await pollSubscriberId(10000);
      if (subId) {
        console.log('[Najva] Subscriber ID:', subId);
        return await saveSubscription(subId);
      }

      console.log('[Najva] Subscriber ID not available after subscribe');
      return false;
    } catch (error) {
      console.error('[Najva] Error subscribing:', error);
      return false;
    }
  }, [user, saveSubscription]);

  // لغو اشتراک
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('najva_subscriptions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsSubscribed(false);
      setSubscriberId(null);
      return true;
    } catch (error) {
      console.error('[Najva] Error unsubscribing:', error);
      return false;
    }
  }, [user]);

  // بررسی خودکار و ذخیره توکن در صورت موجود بودن
  useEffect(() => {
    const autoSaveSubscription = async () => {
      if (!user || isSubscribed) return;

      // منتظر لود شدن نجوا
      const checkNajva = async () => {
        if (window.najva) {
          try {
            const subId = await window.najva.getSubscriberId();
            if (subId) {
              console.log('[Najva] Auto-saving existing subscription:', subId);
              await saveSubscription(subId);
            }
          } catch (error) {
            console.log('[Najva] No existing subscription found');
          }
        }
      };

      // بررسی با تاخیر برای اطمینان از لود شدن نجوا
      setTimeout(checkNajva, 2000);
    };

    autoSaveSubscription();
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
    checkSubscription
  };
};
