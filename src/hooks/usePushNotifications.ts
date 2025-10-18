import { useEffect, useState } from 'react';

export function usePushNotifications() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);
      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported');
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const subscribeToPush = async () => {
    if (!isSupported || permission !== 'granted') {
      throw new Error('Permission not granted');
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // VAPID public key - باید از سرور دریافت شود
      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY';
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      setSubscription(sub);
      
      // ارسال subscription به سرور
      await sendSubscriptionToServer(sub);
      
      return sub;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  };

  const unsubscribe = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      setSubscription(null);
      // حذف subscription از سرور
      await removeSubscriptionFromServer(subscription);
    }
  };

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribeToPush,
    unsubscribe
  };
}

// Helper functions
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

async function sendSubscriptionToServer(subscription: PushSubscription) {
  // TODO: ارسال subscription به سرور Supabase
  // می‌توانید یک edge function ایجاد کنید یا در جدول ذخیره کنید
  console.log('Subscription:', JSON.stringify(subscription));
}

async function removeSubscriptionFromServer(subscription: PushSubscription) {
  // TODO: حذف subscription از سرور
  console.log('Removing subscription:', JSON.stringify(subscription));
}
