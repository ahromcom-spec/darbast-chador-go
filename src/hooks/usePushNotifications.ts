import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePushNotifications() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  // Fetch VAPID public key from server
  useEffect(() => {
    const fetchVapidKey = async () => {
      try {
        console.log('🔑 Fetching VAPID public key...');
        const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
        
        if (error) {
          console.error('❌ Error fetching VAPID key:', error);
          throw error;
        }
        
        if (data?.publicKey) {
          console.log('✅ VAPID key received:', data.publicKey.substring(0, 20) + '...');
          setVapidPublicKey(data.publicKey);
        } else {
          console.error('❌ No publicKey in response:', data);
        }
      } catch (error) {
        console.error('❌ Failed to fetch VAPID public key:', error);
      }
    };

    fetchVapidKey();
  }, []);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);
      console.log('🔔 Push support check:', { supported, serviceWorker: 'serviceWorker' in navigator, PushManager: 'PushManager' in window });
      
      if (supported) {
        setPermission(Notification.permission);
        console.log('🔔 Current permission:', Notification.permission);
        
        // Check for existing subscription
        try {
          const registration = await navigator.serviceWorker.ready;
          const existingSub = await registration.pushManager.getSubscription();
          setSubscription(existingSub);
          console.log('🔔 Existing subscription:', existingSub ? 'Found' : 'None');
        } catch (error) {
          console.error('Error checking existing subscription:', error);
        }
      }
    };

    checkSupport();
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported');
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  const subscribeToPush = useCallback(async (grantedPermission?: NotificationPermission) => {
    console.log('🔔 Starting push subscription process...');
    
    if (!isSupported) {
      console.error('❌ Push notifications not supported');
      throw new Error('Push notifications are not supported');
    }

    // استفاده از مجوز پاس شده یا مجوز فعلی
    const currentPermission = grantedPermission || permission;
    if (currentPermission !== 'granted') {
      console.error('❌ Permission not granted:', currentPermission);
      throw new Error('Permission not granted');
    }

    if (!vapidPublicKey) {
      console.error('❌ VAPID key not available');
      throw new Error('VAPID key not available');
    }

    if (!user) {
      console.error('❌ User not authenticated');
      throw new Error('User not authenticated');
    }

    setLoading(true);

    try {
      console.log('📡 Waiting for Service Worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready:', registration.scope);
      
      // Unsubscribe from existing subscription if any
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        console.log('🔄 Unsubscribing from existing subscription...');
        await existingSub.unsubscribe();
      }

      console.log('📲 Subscribing to push manager...');
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
      
      console.log('✅ Push subscription created:', sub.endpoint.substring(0, 50) + '...');
      setSubscription(sub);
      
      // Save subscription to database
      console.log('💾 Saving subscription to database...');
      await saveSubscriptionToServer(sub, user.id);
      console.log('✅ Subscription saved successfully!');
      
      return sub;
    } catch (error) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isSupported, permission, vapidPublicKey, user]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || !user) return;

    setLoading(true);

    try {
      await subscription.unsubscribe();
      
      // Remove subscription from database
      await removeSubscriptionFromServer(subscription.endpoint, user.id);
      
      setSubscription(null);
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [subscription, user]);

  return {
    isSupported,
    permission,
    subscription,
    loading,
    requestPermission,
    subscribeToPush,
    unsubscribe
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Save subscription to Supabase
async function saveSubscriptionToServer(subscription: PushSubscription, userId: string) {
  const subscriptionJson = subscription.toJSON();
  
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscriptionJson.endpoint!,
      p256dh: subscriptionJson.keys!.p256dh,
      auth: subscriptionJson.keys!.auth,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,endpoint'
    });

  if (error) {
    console.error('Error saving subscription:', error);
    throw error;
  }

  console.log('Push subscription saved successfully');
}

// Remove subscription from Supabase
async function removeSubscriptionFromServer(endpoint: string, userId: string) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Error removing subscription:', error);
    throw error;
  }

  console.log('Push subscription removed successfully');
}
