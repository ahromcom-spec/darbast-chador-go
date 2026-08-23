import { supabase } from '@/integrations/supabase/client';
import { isAdminImpersonating } from './impersonation';
import { extractOrderDescription } from './orderDescription';

// شماره مدیرعامل برای ارسال پیامک
export const CEO_PHONE = '09125511494';

type SmsStatus = 
  | 'submitted'      // سفارش ثبت شد
  | 'approved'       // سفارش تایید شد
  | 'in_progress'    // در حال اجرا
  | 'executed'       // اجرا شد
  | 'awaiting_payment' // در انتظار پرداخت
  | 'paid'           // پرداخت شد
  | 'awaiting_collection' // در انتظار جمع‌آوری
  | 'in_collection'  // در حال جمع‌آوری
  | 'collected'      // جمع‌آوری شد
  | 'completed';     // تکمیل شد

interface OrderSmsDetails {
  orderId?: string;       // شناسه سفارش برای لینک
  serviceType?: string;   // نوع خدمات
  address?: string;       // آدرس
  dateTime?: string;      // تاریخ و زمان شمسی
  amount?: number;        // مبلغ سفارش
  customerName?: string;  // نام مشتری (برای پیامک به مدیرعامل)
  description?: string;   // شرح فعالیت سفارش
}

const normalizeIranPhone = (input?: string | null) => {
  if (!input) return '';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  let raw = String(input)
    .slice(0, 32)
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[^0-9+]/g, '');
  if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
  else if (raw.startsWith('098')) raw = '0' + raw.slice(3);
  else if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
  else if (raw.startsWith('98')) raw = '0' + raw.slice(2);
  if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
  return raw;
};

const isValidIranMobile = (phone?: string | null) => /^09\d{9}$/.test(normalizeIranPhone(phone));

const scaffoldingTypeLabels: Record<string, string> = {
  facade: 'داربست نما',
  facade_with_materials: 'داربست نما',
  column: 'داربست ستون',
  formwork: 'داربست حجمی کفراژ',
  pipe_length: 'داربست متراژ',
  'pipe-length': 'داربست متراژ',
  rental: 'کرایه اجناس داربست',
};

const parseNotes = (notes: unknown): any => {
  if (!notes) return null;
  if (typeof notes === 'object') return notes;
  try {
    let parsed: any = notes;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const resolveOrderSmsDetails = async (orderId?: string | null): Promise<{
  phone?: string;
  orderCode?: string;
  customerName?: string;
  address?: string;
  serviceType?: string;
  amount?: number;
  description?: string;
}> => {
  if (!orderId) return {};

  const { data: order } = await supabase
    .from('projects_v3')
    .select('code, customer_id, customer_name, customer_phone, address, detailed_address, notes, subcategory_id, total_price, payment_amount')
    .eq('id', orderId)
    .maybeSingle();



  if (!order) return {};

  let phone = normalizeIranPhone((order as any).customer_phone);
  let customerName = (order as any).customer_name || undefined;

  if ((!isValidIranMobile(phone) || !customerName) && (order as any).customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('user_id')
      .eq('id', (order as any).customer_id)
      .maybeSingle();

    if (customer?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', customer.user_id)
        .maybeSingle();

      if (!isValidIranMobile(phone)) phone = normalizeIranPhone(profile?.phone_number);
      if (!customerName) customerName = profile?.full_name || undefined;
    }
  }

  const notes = parseNotes((order as any).notes);
  let serviceType =
    notes?.service_type ||
    notes?.serviceType ||
    notes?.scaffoldingType ||
    notes?.scaffold_type ||
    undefined;
  if (serviceType && scaffoldingTypeLabels[serviceType]) serviceType = scaffoldingTypeLabels[serviceType];

  if (!serviceType && (order as any).subcategory_id) {
    const { data: subcategory } = await supabase
      .from('subcategories')
      .select('name')
      .eq('id', (order as any).subcategory_id)
      .maybeSingle();
    serviceType = subcategory?.name || undefined;
  }

  // مبلغ سفارش: اولویت total_price، سپس مبلغ پرداخت/قیمت محاسبه‌شده ذخیره‌شده در notes
  const amountCandidates = [
    (order as any).total_price,
    (order as any).payment_amount,
    notes?.manual_price_override,
    notes?.estimated_price,
    notes?.multi_summary?.grandTotal,
    notes?.price_breakdown?.total,
  ];
  const resolvedAmount = amountCandidates
    .map((v) => Number(v))
    .find((v) => Number.isFinite(v) && v > 0);

  return {
    phone: isValidIranMobile(phone) ? phone : undefined,
    orderCode: (order as any).code || undefined,
    customerName,
    address: buildOrderSmsAddress((order as any).address, (order as any).detailed_address),
    serviceType: serviceType || 'خدمات',
    amount: resolvedAmount,
    description: extractOrderDescription((order as any).notes) || undefined,
  };

};


export const sendOrderSms = async (
  phone: string,
  orderCode: string,
  status: SmsStatus,
  details?: OrderSmsDetails
): Promise<{ success: boolean; error?: string }> => {
  // اگر مدیر در حال مشاهده حساب کاربر است، پیامک ارسال نشود
  if (isAdminImpersonating()) {
    console.log('[sendOrderSms] Skipped - Admin is impersonating user');
    return { success: true };
  }

  let targetPhone = normalizeIranPhone(phone);
  let targetOrderCode = orderCode;
  let smsDetails: OrderSmsDetails = { ...(details || {}) };

  if (details?.orderId && (!isValidIranMobile(targetPhone) || !targetOrderCode || !smsDetails.address || !smsDetails.serviceType || !smsDetails.customerName || !smsDetails.description || smsDetails.amount === undefined)) {
    try {
      const resolved = await resolveOrderSmsDetails(details.orderId);
      if (!isValidIranMobile(targetPhone) && resolved.phone) targetPhone = resolved.phone;
      if (!targetOrderCode && resolved.orderCode) targetOrderCode = resolved.orderCode;
      smsDetails = {
        ...smsDetails,
        address: smsDetails.address || resolved.address,
        serviceType: smsDetails.serviceType || resolved.serviceType,
        customerName: smsDetails.customerName || resolved.customerName,
        description: smsDetails.description || resolved.description,
        amount: smsDetails.amount ?? resolved.amount,
      };
    } catch (e) {
      console.warn('[sendOrderSms] Could not resolve order SMS details:', e);
    }
  }


  if (!isValidIranMobile(targetPhone)) {
    console.warn('[sendOrderSms] Skipped - no valid customer phone', { orderCode: targetOrderCode, orderId: details?.orderId });
    return { success: false, error: 'شماره مشتری برای ارسال پیامک معتبر نیست' };
  }

  if (!targetOrderCode) {
    console.warn('[sendOrderSms] Skipped - no order code', { orderId: details?.orderId });
    return { success: false, error: 'کد سفارش برای ارسال پیامک موجود نیست' };
  }

  // بررسی فعال بودن پیامک برای این مشتری
  try {
    const normalized = targetPhone.trim();
    if (normalized) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('sms_notifications_enabled')
        .eq('phone_number', normalized)
        .maybeSingle();
      if (prof && prof.sms_notifications_enabled === false) {
        console.log('[sendOrderSms] Skipped - SMS disabled for this customer:', normalized);
        return { success: true };
      }
    }
  } catch (e) {
    // در صورت خطا در بررسی، ارسال را ادامه می‌دهیم تا از قطع پیامک جلوگیری شود
  }
  // بازه زمانی مجاز ارسال پیامک: خارج از بازه، پیامک در صف قرار می‌گیرد
  try {
    const sendAfter = getNextAllowedSendTime();
    if (sendAfter) {
      const { data: userRes } = await supabase.auth.getUser();
      const { error: queueError } = await supabase.from('scheduled_sms').insert({
        phone: targetPhone,
        order_code: targetOrderCode,
        order_id: smsDetails.orderId ?? null,
        status_key: status,
        payload: {
          serviceType: smsDetails.serviceType,
          address: smsDetails.address,
          amount: smsDetails.amount,
          customerName: smsDetails.customerName,
          description: smsDetails.description,
        },
        send_after: sendAfter.toISOString(),
        created_by: userRes?.user?.id ?? null,
      });
      if (!queueError) {
        console.log('[sendOrderSms] Scheduled for later delivery:', sendAfter.toISOString());
        return { success: true, scheduledFor: sendAfter.toISOString() };
      }
      console.warn('[sendOrderSms] Could not schedule SMS, sending immediately:', queueError);
    }
  } catch (e) {
    console.warn('[sendOrderSms] Scheduling check failed, sending immediately:', e);
  }

  try {
    console.log(`[sendOrderSms] Sending SMS - Phone: ${targetPhone}, Order: ${targetOrderCode}, Status: ${status}, Details:`, smsDetails);

    
    const { data, error } = await supabase.functions.invoke('send-order-sms', {
      body: { 
        phone: targetPhone, 
        orderCode: targetOrderCode, 
        orderId: smsDetails.orderId,
        status,
        serviceType: smsDetails.serviceType,
        address: smsDetails.address,
        dateTime: smsDetails.dateTime,
        amount: smsDetails.amount,
        customerName: smsDetails.customerName,
        description: smsDetails.description
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

export const sendOrderStageSms = async (
  orderId: string,
  status: SmsStatus,
  details?: OrderSmsDetails
): Promise<{ success: boolean; error?: string }> => {
  const resolved = await resolveOrderSmsDetails(orderId);
  return sendOrderSms(resolved.phone || '', resolved.orderCode || '', status, {
    orderId,
    address: resolved.address,
    serviceType: resolved.serviceType,
    customerName: resolved.customerName,
    description: resolved.description,
    amount: resolved.amount,
    ...(details || {}),
  });
};


// ارسال پیامک به مدیرعامل
export const sendCeoNotificationSms = async (
  orderCode: string,
  status: 'submitted' | 'paid',
  details?: OrderSmsDetails
): Promise<{ success: boolean; error?: string }> => {
  // اگر مدیر در حال مشاهده حساب کاربر است، پیامک به مدیرعامل ارسال نشود
  if (isAdminImpersonating()) {
    console.log('[sendCeoNotificationSms] Skipped - Admin is impersonating user');
    return { success: true };
  }

  try {
    // ارسال پیامک با وضعیت خاص برای مدیرعامل
    const ceoStatus = status === 'submitted' ? 'ceo_new_order' : 'ceo_payment';

    // تکمیل اطلاعات ناقص (مخصوصاً مبلغ سفارش) از روی خود سفارش
    let ceoDetails: OrderSmsDetails = { ...(details || {}) };
    if (
      ceoDetails.orderId &&
      (ceoDetails.amount === undefined ||
        !ceoDetails.address ||
        !ceoDetails.serviceType ||
        !ceoDetails.customerName ||
        !ceoDetails.description)
    ) {
      try {
        const resolved = await resolveOrderSmsDetails(ceoDetails.orderId);
        ceoDetails = {
          ...ceoDetails,
          address: ceoDetails.address || resolved.address,
          serviceType: ceoDetails.serviceType || resolved.serviceType,
          customerName: ceoDetails.customerName || resolved.customerName,
          description: ceoDetails.description || resolved.description,
          amount: ceoDetails.amount ?? resolved.amount,
        };
      } catch (e) {
        console.warn('[sendCeoNotificationSms] Could not resolve order details:', e);
      }
    }

    console.log(`[sendCeoNotificationSms] Sending CEO SMS - Order: ${orderCode}, Status: ${ceoStatus}, Details:`, ceoDetails);

    const { data, error } = await supabase.functions.invoke('send-order-sms', {
      body: { 
        phone: CEO_PHONE, 
        orderCode, 
        orderId: ceoDetails.orderId,
        status: ceoStatus,
        serviceType: ceoDetails.serviceType,
        address: ceoDetails.address,
        dateTime: ceoDetails.dateTime,
        amount: ceoDetails.amount,
        customerName: ceoDetails.customerName,
        description: ceoDetails.description
      }
    });


    if (error) {
      console.error('[sendCeoNotificationSms] Error:', error);
      return { success: false, error: error.message };
    }

    console.log('[sendCeoNotificationSms] Response:', data);
    return { success: true };
  } catch (err: any) {
    console.error('[sendCeoNotificationSms] Exception:', err);
    return { success: false, error: err.message };
  }
};


// Helper to build a consistent address string for SMS (no duplicated parts)
export const buildOrderSmsAddress = (
  address?: string | null,
  detailedAddress?: string | null
): string => {
  const norm = (s: string) => s.replace(/[\s،,.\-]+/g, '').trim();
  const base = (address || '').trim();
  const detail = (detailedAddress || '').trim();

  if (base && detail) {
    const nb = norm(base);
    const nd = norm(detail);
    // اگر یکی از آن‌ها شامل دیگری است، فقط طولانی‌تر را برگردان تا آدرس تکراری ارسال نشود
    if (nb === nd || nd.includes(nb)) return detail;
    if (nb.includes(nd)) return base;
    return `${base} - ${detail}`;
  }
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

