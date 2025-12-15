import { supabase } from '@/integrations/supabase/client';

type SmsStatus = 
  | 'submitted'      // سفارش ثبت شد
  | 'approved'       // سفارش تایید شد
  | 'in_progress'    // در حال اجرا
  | 'executed'       // اجرا شد
  | 'awaiting_payment' // در انتظار پرداخت
  | 'paid'           // پرداخت شد
  | 'in_collection'  // در حال جمع‌آوری
  | 'completed';     // تکمیل شد

interface OrderSmsDetails {
  orderId?: string;       // شناسه سفارش برای لینک
  serviceType?: string;   // نوع خدمات
  address?: string;       // آدرس
  dateTime?: string;      // تاریخ و زمان شمسی
  amount?: number;        // مبلغ سفارش
}

export const sendOrderSms = async (
  phone: string,
  orderCode: string,
  status: SmsStatus,
  details?: OrderSmsDetails
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`[sendOrderSms] Sending SMS - Phone: ${phone}, Order: ${orderCode}, Status: ${status}, Details:`, details);
    
    const { data, error } = await supabase.functions.invoke('send-order-sms', {
      body: { 
        phone, 
        orderCode, 
        orderId: details?.orderId,
        status,
        serviceType: details?.serviceType,
        address: details?.address,
        dateTime: details?.dateTime,
        amount: details?.amount
      }
    });

    if (error) {
      console.error('[sendOrderSms] Error:', error);
      return { success: false, error: error.message };
    }

    console.log('[sendOrderSms] Response:', data);
    return { success: true };
  } catch (err: any) {
    console.error('[sendOrderSms] Exception:', err);
    return { success: false, error: err.message };
  }
};


// Helper to build a consistent address string for SMS
export const buildOrderSmsAddress = (
  address?: string | null,
  detailedAddress?: string | null
): string => {
  const base = (address || '').trim();
  const detail = (detailedAddress || '').trim();

  if (base && detail) return `${base} - ${detail}`;
  return base || detail || 'ثبت نشده';
};

// Helper to map execution stages to SMS status
export const getSmStatusFromExecutionStage = (stage: string): SmsStatus | null => {
  const stageMap: Record<string, SmsStatus> = {
    'order_executed': 'executed',
    'awaiting_payment': 'awaiting_payment',
    'in_collection': 'in_collection',
    'awaiting_collection': 'in_collection',
    'completed': 'completed',
    'closed': 'completed',
  };
  return stageMap[stage] || null;
};

// Helper to map order status to SMS status
export const getSmsStatusFromOrderStatus = (status: string): SmsStatus | null => {
  const statusMap: Record<string, SmsStatus> = {
    'pending': 'submitted',
    'approved': 'approved',
    'in_progress': 'in_progress',
    'completed': 'awaiting_payment',
    'paid': 'paid',
    'closed': 'completed',
  };
  return statusMap[status] || null;
};

