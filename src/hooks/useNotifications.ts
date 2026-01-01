import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  title: string;
  body: string;
  link?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read_at?: string;
  created_at: string;
}

// تنظیم بج روی آیکون برنامه (PWA App Badge)
const updateAppBadge = (count: number) => {
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    } catch (error) {
      console.log('App Badge API error:', error);
    }
  }
};

// نمایش اعلان سیستمی با صدا
const showSystemNotification = (title: string, body: string, link?: string) => {
  // بررسی پشتیبانی و مجوز
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return;
  }
  
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/ahrom-pwa-icon.png',
        badge: '/ahrom-pwa-icon.png',
        tag: `ahrom-${Date.now()}`, // یکتا برای هر اعلان
        requireInteraction: false,
        silent: false // صدای پیش‌فرض سیستم پخش شود
      });
      
      // کلیک روی اعلان
      notification.onclick = () => {
        window.focus();
        if (link) {
          window.location.href = link;
        }
        notification.close();
      };
      
      // بستن خودکار بعد از 5 ثانیه
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.log('Error showing notification:', error);
    }
  }
};

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const cleanup = subscribeToNotifications();
      return cleanup;
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const notifs = (data || []) as Notification[];
      
      // ذخیره آخرین id برای تشخیص اعلان‌های جدید
      if (notifs.length > 0 && !lastNotificationIdRef.current) {
        lastNotificationIdRef.current = notifs[0].id;
      }
      
      setNotifications(notifs);
      const unread = data?.filter(n => !n.read_at).length || 0;
      setUnreadCount(unread);
      // به‌روزرسانی بج برنامه
      updateAppBadge(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!user) return () => {};

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          
          // نمایش اعلان سیستمی با صدا
          showSystemNotification(newNotif.title, newNotif.body, newNotif.link);
          
          setNotifications(prev => [newNotif, ...prev.slice(0, 19)]);
          setUnreadCount(prev => {
            const newCount = prev + 1;
            // به‌روزرسانی بج برنامه
            updateAppBadge(newCount);
            return newCount;
          });
          lastNotificationIdRef.current = newNotif.id;
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => {
        const newCount = Math.max(0, prev - 1);
        // به‌روزرسانی بج برنامه
        updateAppBadge(newCount);
        return newCount;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};
