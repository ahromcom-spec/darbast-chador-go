import { supabase } from '@/integrations/supabase/client';
import { isAdminImpersonating } from './impersonation';

interface PushNotificationPayload {
  user_id: string;
  title: string;
  body: string;
  link?: string;
  order_id?: string;
  type?: string;
}

interface NotifyManagersPayload {
  orderCode?: string;
  order_code?: string;
  orderId?: string;
  order_id?: string;
  serviceType?: string;
  service_type?: string;
  address?: string;
  customerPhone?: string;
  customer_phone?: string;
  customerName?: string;
  customer_name?: string;
}

/**
 * ارسال Push Notification - اگر مدیر در حال مشاهده حساب کاربر است، ارسال نمی‌شود
 */
export const sendPushNotification = async (payload: PushNotificationPayload): Promise<{ success: boolean; error?: string }> => {
  // اگر مدیر در حال مشاهده حساب کاربر است، نوتیفیکیشن ارسال نشود
  if (isAdminImpersonating()) {
    console.log('[sendPushNotification] Skipped - Admin is impersonating user');
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: payload
    });

    if (error) {
      console.error('[sendPushNotification] Error:', error);
      return { success: false, error: error.message };
    }

    console.log('[sendPushNotification] Success:', data);
    return { success: true };
  } catch (err: any) {
    console.error('[sendPushNotification] Exception:', err);
    return { success: false, error: err.message };
  }
};

/**
 * ارسال اعلان به مدیران - اگر مدیر در حال مشاهده حساب کاربر است، ارسال نمی‌شود
 */
export const notifyManagers = async (payload: NotifyManagersPayload): Promise<{ success: boolean; error?: string }> => {
  // اگر مدیر در حال مشاهده حساب کاربر است، نوتیفیکیشن به مدیران ارسال نشود
  if (isAdminImpersonating()) {
    console.log('[notifyManagers] Skipped - Admin is impersonating user');
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('notify-managers-new-order', {
      body: payload
    });

    if (error) {
      console.error('[notifyManagers] Error:', error);
      return { success: false, error: error.message };
    }

    console.log('[notifyManagers] Success:', data);
    return { success: true };
  } catch (err: any) {
    console.error('[notifyManagers] Exception:', err);
    return { success: false, error: err.message };
  }
};

/**
 * ایجاد اعلان درون برنامه‌ای با RPC - اگر مدیر در حال مشاهده حساب کاربر است، ایجاد نمی‌شود
 */
export const sendNotificationRpc = async (
  userId: string,
  title: string,
  body: string,
  link?: string,
  type: string = 'info'
): Promise<{ success: boolean; error?: string }> => {
  // اگر مدیر در حال مشاهده حساب کاربر است، اعلان درون برنامه‌ای ایجاد نشود
  if (isAdminImpersonating()) {
    console.log('[sendNotificationRpc] Skipped - Admin is impersonating user');
    return { success: true };
  }

  try {
    const { error } = await supabase.rpc('send_notification', {
      _user_id: userId,
      _title: title,
      _body: body,
      _link: link,
      _type: type
    });

    if (error) {
      console.error('[sendNotificationRpc] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[sendNotificationRpc] Exception:', err);
    return { success: false, error: err.message };
  }
};

/**
 * ایجاد اعلان درون برنامه‌ای با insert مستقیم - اگر مدیر در حال مشاهده حساب کاربر است، ایجاد نمی‌شود
 */
export const createInAppNotification = async (
  userId: string,
  title: string,
  body: string,
  link?: string,
  type: string = 'info'
): Promise<{ success: boolean; error?: string }> => {
  // اگر مدیر در حال مشاهده حساب کاربر است، اعلان درون برنامه‌ای ایجاد نشود
  if (isAdminImpersonating()) {
    console.log('[createInAppNotification] Skipped - Admin is impersonating user');
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        body,
        link,
        type
      });

    if (error) {
      console.error('[createInAppNotification] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[createInAppNotification] Exception:', err);
    return { success: false, error: err.message };
  }
};
