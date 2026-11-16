// پیامک همکاران سفارش و پیام دستی مدیریت از کادر سفارش.
// - هر همکار پذیرفته‌شده یک کلید پیامک دارد؛ فقط همکارانِ روشن با تغییر مراحل سفارش پیام می‌گیرند (سرور اعمال می‌کند).
// - پیام دستی با المان‌های سفارش از خط خدماتی سایت به مشتری و/یا همکاران انتخاب‌شده فرستاده می‌شود.
import { supabase } from '@/integrations/supabase/client';
import { isAdminImpersonating } from './impersonation';
export { ORDER_MESSAGE_ELEMENTS, insertElementAt } from './orderMessageElements';

/** خط خدماتی ارسال پیامک سایت */
export const SMS_SERVICE_LINE = '90000319';

export interface OrderCollaboratorSms {
  id: string;
  order_id: string;
  name: string;
  phone: string | null;
  collaborator_role: string | null;
  sms_enabled: boolean;
  /** همکار پیامک‌ها را در حساب خودش خاموش کرده؛ با روشن کردن کلید هم پیامی نمی‌گیرد */
  sms_opted_out: boolean;
}

export async function fetchOrderCollaboratorsSms(orderIds: string[]): Promise<OrderCollaboratorSms[]> {
  const ids = Array.from(new Set(orderIds.filter(Boolean))).slice(0, 500);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('get_order_collaborators_sms' as any, { _order_ids: ids } as any);
  if (error) throw error;
  return ((data as any[]) || []) as OrderCollaboratorSms[];
}

export function groupCollaboratorsByOrder(rows: OrderCollaboratorSms[]): Map<string, OrderCollaboratorSms[]> {
  const map = new Map<string, OrderCollaboratorSms[]>();
  for (const r of rows) {
    const list = map.get(r.order_id) || [];
    list.push(r);
    map.set(r.order_id, list);
  }
  return map;
}

export async function setOrderCollaboratorSms(collaboratorId: string, enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_order_collaborator_sms' as any, { _collaborator_id: collaboratorId, _enabled: enabled } as any);
  if (error) throw error;
  return data === true;
}

export interface ManualMessageResult {
  kind: 'customer' | 'collaborator';
  id?: string;
  name: string;
  phone: string;
  status: 'sent' | 'skipped' | 'failed';
  note?: string;
}

const invokeManual = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('send-order-manual-message', { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error) msg = String(j.error);
      }
    } catch { /* ignore */ }
    throw new Error(msg || 'ارسال پیام انجام نشد');
  }
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as any;
};

export async function previewOrderManualMessage(orderId: string, message: string, description?: string): Promise<string> {
  const data = await invokeManual({ orderId, message, preview: true, description });
  return String(data?.previewMessage || '');
}

export async function sendOrderManualMessage(input: {
  orderId: string; message: string; customer: boolean; collaboratorIds: string[]; description?: string;
}): Promise<ManualMessageResult[]> {
  if (isAdminImpersonating()) throw new Error('در حالت ورود به حساب کاربر، پیامک ارسال نمی‌شود');
  const data = await invokeManual({ ...input, preview: false });
  return (data?.results || []) as ManualMessageResult[];
}
