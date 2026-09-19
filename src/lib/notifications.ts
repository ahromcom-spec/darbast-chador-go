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
  customerUserId?: string;
  customer_user_id?: string;
}

const CEO_PHONE = '09125511494';
let ceoUserIdCache: string | null = null;

const getCEOUserId = async (): Promise<string | null> => {
  if (ceoUserIdCache) return ceoUserIdCache;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone_number', CEO_PHONE)
      .maybeSingle();
    ceoUserIdCache = (data?.user_id as string) || null;
    return ceoUserIdCache;
  } catch {
    return null;
  }
};

/**
 * Send a Najva push + in-app notification to a specific user via the
 * `send-push-notification` edge function. Suppressed during admin impersonation.
 */
export const sendPushNotification = async (
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (isAdminImpersonating?.()) {
      console.log('[sendPushNotification] Skipped (admin impersonating)');
      return { success: true };
    }
    if (!payload.user_id) return { success: false, error: 'missing user_id' };

    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: payload.user_id,
        title: payload.title,
        body: payload.body,
        link: payload.link,
        type: payload.type || 'info',
      },
    });
    if (error) {
      console.error('[sendPushNotification] error', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[sendPushNotification] Exception:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Notify CEO (Najva push + in-app) for new orders. Also pushes a thank-you
 * notification to the submitting customer when customer_user_id is provided.
 */
export const notifyManagers = async (
  payload: NotifyManagersPayload
): Promise<{ success: boolean; error?: string }> => {
  try {
    const orderCode = payload.orderCode || payload.order_code || '';
    const orderId = payload.orderId || payload.order_id || '';
    const serviceType = payload.serviceType || payload.service_type || 'سفارش';
    const customerName = payload.customerName || payload.customer_name || '';
    const customerPhone = payload.customerPhone || payload.customer_phone || '';
    const customerUserId = payload.customerUserId || payload.customer_user_id || '';

    // CEO push
    const ceoUserId = await getCEOUserId();
    if (ceoUserId) {
      const title = `سفارش جدید${orderCode ? ` - ${orderCode}` : ''}`;
      const bodyParts = [serviceType];
      if (customerName) bodyParts.push(customerName);
      if (customerPhone) bodyParts.push(customerPhone);
      const body = bodyParts.join(' • ');
      const link = orderId ? `/executive/orders/${orderId}` : '/executive';
      await sendPushNotification({
        user_id: ceoUserId,
        title,
        body,
        link,
        type: 'new_order',
      });
    }

    // Customer "submission received" push
    if (customerUserId) {
      await sendPushNotification({
        user_id: customerUserId,
        title: 'سفارش شما ثبت شد ✓',
        body: `سفارش${orderCode ? ` ${orderCode}` : ''} (${serviceType}) با موفقیت ثبت شد و در انتظار بررسی است.`,
        link: orderId ? `/user/orders/${orderId}` : '/user/my-orders',
        type: 'order_submitted',
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('[notifyManagers] Exception:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Notify CEO when a payment is recorded (online via ZarinPal or manual).
 */
export const notifyCEOPayment = async (params: {
  orderCode?: string;
  orderId?: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  method?: 'zarinpal' | 'manual' | string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    if (isAdminImpersonating?.()) {
      console.log('[notifyCEOPayment] Skipped (admin impersonating)');
      return { success: true };
    }
    const ceoUserId = await getCEOUserId();
    if (!ceoUserId) return { success: false, error: 'CEO not found' };

    const methodLabel =
      params.method === 'zarinpal'
        ? 'پرداخت آنلاین'
        : params.method === 'manual'
        ? 'پرداخت دستی'
        : 'پرداخت';
    const title = `${methodLabel} - ${(params.amount || 0).toLocaleString('fa-IR')} تومان`;
    const bodyParts: string[] = [];
    if (params.orderCode) bodyParts.push(`سفارش ${params.orderCode}`);
    if (params.customerName) bodyParts.push(params.customerName);
    if (params.customerPhone) bodyParts.push(params.customerPhone);
    const body = bodyParts.join(' • ') || 'پرداخت جدید در سایت';
    const link = params.orderId ? `/executive/orders/${params.orderId}` : '/executive';

    await sendPushNotification({
      user_id: ceoUserId,
      title,
      body,
      link,
      type: 'payment_received',
    });
    return { success: true };
  } catch (err: any) {
    console.error('[notifyCEOPayment] Exception:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Send a notification to everyone currently entitled to an order:
 * the current owner (after a transfer this is the new customer only)
 * plus every accepted collaborator of that order.
 */
export const notifyOrderParties = async (
  orderId: string,
  payload: { title: string; body: string; link?: string; type?: string }
): Promise<{ success: boolean; recipients: number; error?: string }> => {
  try {
    if (!orderId) return { success: false, recipients: 0, error: 'missing orderId' };

    const { data, error } = await supabase.rpc('get_order_notification_recipients' as any, {
      _order_id: orderId,
    });
    if (error) throw error;

    const ids = Array.from(
      new Set(
        ((data as { user_id: string }[] | null) || [])
          .map((r) => r.user_id)
          .filter(Boolean)
      )
    );

    await Promise.all(
      ids.map((uid) =>
        sendPushNotification({
          user_id: uid,
          title: payload.title,
          body: payload.body,
          link: payload.link,
          order_id: orderId,
          type: payload.type || 'info',
        })
      )
    );

    return { success: true, recipients: ids.length };
  } catch (err: any) {
    console.error('[notifyOrderParties] Exception:', err);
    return { success: false, recipients: 0, error: err.message };
  }
};

/**
 * In-app notification via RPC — disabled (kept as no-op for compatibility).
 */
export const sendNotificationRpc = async (
  _userId: string,
  _title: string,
  _body: string,
  _link?: string,
  _type: string = 'info'
): Promise<{ success: boolean; error?: string }> => {
  return { success: true };
};

/**
 * Direct in-app notification insert — disabled (kept as no-op for compatibility).
 */
export const createInAppNotification = async (
  _userId: string,
  _title: string,
  _body: string,
  _link?: string,
  _type: string = 'info'
): Promise<{ success: boolean; error?: string }> => {
  return { success: true };
};
