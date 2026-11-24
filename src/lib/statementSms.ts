import { supabase } from '@/integrations/supabase/client';
import { isAdminImpersonating } from '@/lib/impersonation';

export type StatementSmsEvent =
  | { kind: 'payment'; groupId: string }
  | { kind: 'discount'; statementId: string }
  | { kind: 'discount'; customerId: string }
  | { kind: 'closed'; statementId: string };

/**
 * قاب‌های پیام صورتحساب (ثبت پرداخت، تخفیف، بستن) را پس از ثبت واقعی فعال می‌کند.
 * سرور همه مقادیر را از پایگاه داده می‌خواند و فقط رویدادهای تازه مدیران را می‌پذیرد؛ خطا هرگز ثبت مالی را متوقف نمی‌کند.
 */
export async function notifyStatementEvent(event: StatementSmsEvent): Promise<void> {
  try {
    if (isAdminImpersonating()) return;
    await supabase.functions.invoke('dispatch-order-messages', { body: { statementEvent: event, source: 'statement' } });
  } catch (e) {
    console.warn('[statementSms] dispatch failed', e);
  }
}
