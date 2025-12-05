import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

export function useOneSignal() {
  const { user } = useAuth();
  const [appId, setAppId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  // Fetch App ID from server
  useEffect(() => {
    const fetchAppId = async () => {
      try {
        console.log('🔑 Fetching OneSignal App ID...');
        const { data, error } = await supabase.functions.invoke('get-onesignal-app-id');
        
        if (error) {
          console.error('❌ Error fetching OneSignal App ID:', error);
          return;
        }
        
        if (data?.appId) {
          console.log('✅ OneSignal App ID received');
          setAppId(data.appId);
        }
      } catch (error) {
        console.error('❌ Failed to fetch OneSignal App ID:', error);
      }
    };

    fetchAppId();
  }, []);

  // Initialize OneSignal when App ID is available
  useEffect(() => {
    if (!appId || typeof window === 'undefined') return;
    
    // Check if already initialized
    if (window.OneSignal?.initialized) {
      setIsInitialized(true);
      return;
    }

    const initOneSignal = async () => {
      // Wait for OneSignal SDK to load
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          console.log('🔔 Initializing OneSignal with App ID...');
          
          await OneSignal.init({
            appId: appId,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: '/' },
            promptOptions: {
              slidedown: {
                prompts: [{
                  type: "push",
                  autoPrompt: false,
                  text: {
                    actionMessage: "برای دریافت تماس‌ها و وضعیت سفارشات، اعلان‌ها را فعال کنید",
                    acceptButton: "فعال‌سازی",
                    cancelButton: "بعداً"
                  }
                }]
              }
            }
          });

          setIsInitialized(true);
          console.log('✅ OneSignal initialized');

          // Check current subscription status
          const subscribed = await OneSignal.User.PushSubscription.optedIn;
          setIsSubscribed(subscribed || false);
          
          // Update permission state
          const perm = await OneSignal.Notifications.permission;
          setPermission(perm ? 'granted' : 'default');

          // Listen for subscription changes
          OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
            console.log('🔔 Subscription changed:', event);
            setIsSubscribed(event.current.optedIn || false);
          });

        } catch (error) {
          console.error('❌ OneSignal init error:', error);
        }
      });
    };

    initOneSignal();
  }, [appId]);

  // Set external user ID when user logs in
  useEffect(() => {
    if (!isInitialized || !user?.id || !window.OneSignal) return;

    const setUserId = async () => {
      try {
        console.log('🔔 Setting OneSignal external user ID:', user.id);
        await window.OneSignal.login(user.id);
        console.log('✅ OneSignal user ID set');
      } catch (error) {
        console.error('❌ Error setting OneSignal user ID:', error);
      }
    };

    setUserId();
  }, [isInitialized, user?.id]);

  // Request permission and subscribe
  const subscribe = useCallback(async () => {
    if (!isInitialized || !window.OneSignal) {
      throw new Error('OneSignal not initialized');
    }

    setLoading(true);
    try {
      console.log('🔔 Requesting OneSignal permission...');
      
      // Show native permission prompt
      await window.OneSignal.Notifications.requestPermission();
      
      // Check if granted
      const perm = await window.OneSignal.Notifications.permission;
      setPermission(perm ? 'granted' : 'denied');
      
      if (perm) {
        // Opt in to push
        await window.OneSignal.User.PushSubscription.optIn();
        setIsSubscribed(true);
        console.log('✅ OneSignal subscribed successfully');
        return true;
      } else {
        console.log('❌ OneSignal permission denied');
        return false;
      }
    } catch (error) {
      console.error('❌ OneSignal subscribe error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!isInitialized || !window.OneSignal) return;

    setLoading(true);
    try {
      await window.OneSignal.User.PushSubscription.optOut();
      setIsSubscribed(false);
      console.log('✅ OneSignal unsubscribed');
    } catch (error) {
      console.error('❌ OneSignal unsubscribe error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);

  return {
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
    isInitialized,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe
  };
}
