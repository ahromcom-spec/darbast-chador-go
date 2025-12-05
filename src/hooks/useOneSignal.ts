import { useEffect, useState, useCallback, useRef } from 'react';
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
  const initAttemptedRef = useRef(false);

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
          console.log('✅ OneSignal App ID received:', data.appId.substring(0, 8) + '...');
          setAppId(data.appId);
        } else {
          console.error('❌ No App ID in response');
        }
      } catch (error) {
        console.error('❌ Failed to fetch OneSignal App ID:', error);
      }
    };

    fetchAppId();
  }, []);

  // Initialize OneSignal when App ID is available
  useEffect(() => {
    if (!appId || typeof window === 'undefined' || initAttemptedRef.current) return;
    
    initAttemptedRef.current = true;
    console.log('🔔 Starting OneSignal initialization...');

    const initOneSignal = async () => {
      // Wait for SDK to be available with timeout - افزایش به 15 ثانیه برای اینترنت کند
      const waitForSDK = (): Promise<any> => {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 150; // 15 seconds max wait
          
          const checkSDK = () => {
            attempts++;
            if (attempts % 10 === 0) {
              console.log(`🔔 Checking for OneSignal SDK (attempt ${attempts})...`);
            }
            
            if (window.OneSignal) {
              console.log('✅ OneSignal SDK found directly');
              resolve(window.OneSignal);
              return;
            }
            
            if (attempts >= maxAttempts) {
              reject(new Error('OneSignal SDK not loaded after timeout'));
              return;
            }
            
            setTimeout(checkSDK, 100);
          };
          
          checkSDK();
        });
      };

      try {
        const OneSignal = await waitForSDK();
        
        console.log('🔔 Initializing OneSignal with App ID...');
        
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/' },
          notificationClickHandlerMatch: 'origin',
          notificationClickHandlerAction: 'navigate',
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
        console.log('✅ OneSignal initialized successfully');

        // Handle notification click - navigate to the URL in notification data
        try {
          OneSignal.Notifications.addEventListener('click', (event: any) => {
            console.log('🔔 Notification clicked:', event);
            const url = event.notification?.launchURL || event.notification?.data?.url;
            if (url) {
              console.log('🔔 Navigating to:', url);
              window.location.href = url;
            }
          });
        } catch (e) {
          console.log('⚠️ Could not add click listener:', e);
        }

        // Check current subscription status
        try {
          const subscribed = await OneSignal.User.PushSubscription.optedIn;
          console.log('🔔 Current subscription status:', subscribed);
          setIsSubscribed(subscribed || false);
        } catch (e) {
          console.log('⚠️ Could not check subscription:', e);
        }
        
        // Update permission state
        try {
          const perm = await OneSignal.Notifications.permission;
          console.log('🔔 Current permission status:', perm);
          setPermission(perm ? 'granted' : 'default');
        } catch (e) {
          console.log('⚠️ Could not check permission:', e);
        }

        // Listen for subscription changes
        try {
          OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
            console.log('🔔 Subscription changed:', event);
            setIsSubscribed(event.current?.optedIn || false);
          });
        } catch (e) {
          console.log('⚠️ Could not add subscription listener:', e);
        }

      } catch (error) {
        console.error('❌ OneSignal init error:', error);
        // Still mark as initialized so button isn't permanently disabled
        setIsInitialized(true);
      }
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
    setLoading(true);
    try {
      console.log('🔔 Requesting notification permission...');
      
      // Wait for OneSignal SDK if not available - افزایش timeout به 10 ثانیه
      let OneSignal = window.OneSignal;
      if (!OneSignal) {
        console.log('🔔 Waiting for OneSignal SDK...');
        let attempts = 0;
        while (!window.OneSignal && attempts < 100) { // 10 seconds
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        OneSignal = window.OneSignal;
      }
      
      if (!OneSignal) {
        // Fallback to native Notification API
        console.log('⚠️ OneSignal not available, using native API');
        const permission = await Notification.requestPermission();
        setPermission(permission);
        if (permission === 'granted') {
          setIsSubscribed(true);
          return true;
        }
        return false;
      }
      
      // Try to initialize OneSignal if not already
      if (!isInitialized && appId) {
        console.log('🔔 Initializing OneSignal on-demand...');
        try {
          await OneSignal.init({
            appId: appId,
            allowLocalhostAsSecureOrigin: true,
          });
          setIsInitialized(true);
        } catch (initError: any) {
          // Might already be initialized
          if (!initError?.message?.includes('already')) {
            console.error('❌ Init error:', initError);
          }
        }
      }
      
      // Show native permission prompt
      await OneSignal.Notifications.requestPermission();
      
      // Check if granted
      const perm = await OneSignal.Notifications.permission;
      setPermission(perm ? 'granted' : 'denied');
      
      if (perm) {
        // Opt in to push
        await OneSignal.User.PushSubscription.optIn();
        setIsSubscribed(true);
        console.log('✅ OneSignal subscribed successfully');
        return true;
      } else {
        console.log('❌ OneSignal permission denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Subscribe error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isInitialized, appId]);

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
