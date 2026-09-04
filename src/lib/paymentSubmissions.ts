import { supabase } from '@/integrations/supabase/client';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';
import { compressImage, isImageFile } from '@/lib/imageOptimizer';

export const PAYMENT_RECEIPTS_BUCKET = 'payment-receipts';

export type PaymentSubmissionKind = 'receipt' | 'cheque';
export type PaymentSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentSubmission {
  id: string;
  order_id: string | null;
  statement_id: string | null;
  customer_id: string | null;
  submitted_by: string;
  kind: PaymentSubmissionKind;
  amount: number;
  notes: string | null;
  image_path: string | null;
  cheque_serial: string | null;
  cheque_due_date: string | null;
  status: PaymentSubmissionStatus;
  bank_card_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  order_payment_ids: string[] | null;
  transaction_id: string | null;
  cheque_id: string | null;
  created_at: string;
}

export const kindLabels: Record<PaymentSubmissionKind, string> = {
  receipt: 'فیش واریزی',
  cheque: 'چک',
};

export const submissionStatusLabels: Record<PaymentSubmissionStatus, { label: string; cls: string }> = {
  pending: { label: 'در انتظار تایید مدیریت', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  approved: { label: 'تایید شده', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { label: 'رد شده', cls: 'bg-red-100 text-red-800 border-red-300' },
};

/** Upload a receipt/cheque image into the private receipts bucket. Returns the storage path. */
export async function uploadPaymentImage(file: File, userId: string): Promise<string> {
  const prepared = isImageFile(file) ? await compressImage(file, { maxDimension: 1800, quality: 0.8 }) : file;
  const ext = (prepared.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .upload(path, prepared, { upsert: true, contentType: prepared.type || undefined });
  if (error) throw error;
  return path;
}

/** Create signed URLs for a set of storage paths. */
export async function signPaymentImages(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean) as string[]));
  const out: Record<string, string> = {};
  await Promise.all(unique.map(async (p) => {
    try {
      const { data } = await supabase.storage.from(PAYMENT_RECEIPTS_BUCKET).createSignedUrl(p, 60 * 60);
      if (data?.signedUrl) out[p] = data.signedUrl;
    } catch {
      /* ignore */
    }
  }));
  return out;
}

interface OrderAllocationTarget {
  id: string;
  code: string;
  total: number;
  paid: number;
  remaining: number;
  created_at: string;
}

async function loadTargetOrders(sub: PaymentSubmission): Promise<OrderAllocationTarget[]> {
  let query = supabase
    .from('projects_v3')
    .select('id, code, total_price, total_paid, created_at, status');
  if (sub.order_id) {
    query = query.eq('id', sub.order_id);
  } else if (sub.statement_id) {
    query = query.eq('statement_id', sub.statement_id);
  } else {
    return [];
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((o: any) => {
    const total = Number(o.total_price) || 0;
    const paid = Number(o.total_paid) || 0;
    return {
      id: o.id,
      code: String(o.code ?? ''),
      total,
      paid,
      remaining: Math.max(0, total - paid),
      created_at: o.created_at,
    };
  }).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export interface ApproveOptions {
  submission: PaymentSubmission;
  bankCardId: string | null;
  reviewerId: string;
  reviewNotes?: string;
  customerName?: string | null;
}

/**
 * Approve a customer payment submission: allocate the amount to the related order(s),
 * register order_payments (with the receipt image), create the bank card transaction on
 * the selected card and — for cheques — create the cheque record.
 */
export async function approvePaymentSubmission({
  submission, bankCardId, reviewerId, reviewNotes, customerName,
}: ApproveOptions): Promise<void> {
  const orders = await loadTargetOrders(submission);
  if (orders.length === 0) throw new Error('سفارش مرتبط با این فیش پیدا نشد');

  const isCheque = submission.kind === 'cheque';
  const amount = Math.round(Number(submission.amount) || 0);
  if (amount <= 0) throw new Error('مبلغ فیش نامعتبر است');

  // Waterfall allocation: fill oldest orders first, remainder lands on the last order
  let remaining = amount;
  const allocations: { order: OrderAllocationTarget; portion: number }[] = [];
  for (let i = 0; i < orders.length; i++) {
    if (remaining <= 0) break;
    const o = orders[i];
    const isLast = i === orders.length - 1;
    const take = isLast ? remaining : Math.min(remaining, o.remaining);
    if (take > 0) {
      allocations.push({ order: o, portion: take });
      remaining -= take;
    }
  }
  if (allocations.length === 0) allocations.push({ order: orders[orders.length - 1], portion: amount });

  const nowIso = new Date().toISOString();
  const effectiveDate = isCheque ? (submission.cheque_due_date || nowIso) : nowIso;
  const paymentMethod = isCheque ? 'cheque' : (bankCardId ? 'card_transfer' : 'cash');
  const baseNote = isCheque
    ? `چک مشتری${submission.cheque_serial ? ` شماره ${submission.cheque_serial}` : ''} (تاییدشده توسط مدیریت)`
    : 'فیش واریزی مشتری (تاییدشده توسط مدیریت)';
  const note = `${baseNote}${submission.notes ? ` — ${submission.notes}` : ''}`;

  const insertedPaymentIds: string[] = [];
  for (const { order, portion } of allocations) {
    const summary = buildGroupPaymentSummary({
      totalAmount: amount,
      portion,
      date: effectiveDate,
      method: isCheque ? 'cheque' : (bankCardId ? 'card' : 'cash'),
    });
    const { data: ins, error: insErr } = await supabase
      .from('order_payments')
      .insert({
        order_id: order.id,
        amount: portion,
        payment_method: paymentMethod,
        receipt_number: submission.cheque_serial || null,
        notes: note,
        paid_by: reviewerId,
        bank_card_id: bankCardId,
        payment_date: effectiveDate,
        receipt_image_url: submission.image_path,
      } as any)
      .select('id')
      .single();
    if (insErr) throw insErr;
    if (ins?.id) insertedPaymentIds.push(ins.id);

    const newPaid = order.paid + portion;
    const updatePayload: Record<string, any> = { total_paid: newPaid, updated_at: nowIso };
    if (!isCheque && order.total > 0 && newPaid >= order.total) {
      updatePayload.payment_confirmed_at = nowIso;
      updatePayload.payment_confirmed_by = reviewerId;
      const { data: cur } = await supabase
        .from('projects_v3')
        .select('status')
        .eq('id', order.id)
        .maybeSingle();
      // مرحله اجرایی خودکار به «در انتظار جمع‌آوری» نمی‌رود
      if (cur?.status !== 'closed') updatePayload.status = 'paid';
    }
    const { error: updErr } = await supabase.from('projects_v3').update(updatePayload).eq('id', order.id);
    if (updErr) throw updErr;
  }

  // Bank card transaction
  let transactionId: string | null = null;
  if (bankCardId) {
    const { data: card } = await supabase
      .from('bank_cards')
      .select('current_balance')
      .eq('id', bankCardId)
      .single();
    const newBal = Number(card?.current_balance || 0) + amount;
    const codes = allocations.map(a => a.order.code).join('، ');
    const description = isCheque
      ? `🟠 چک وصول نشده است — سریال ${submission.cheque_serial || '-'} — فیش مشتری ${customerName || ''} - سفارش‌های: ${codes} [SUB:${submission.id}]`
      : `فیش واریزی مشتری ${customerName || ''} - سفارش‌های: ${codes} [SUB:${submission.id}]`;
    const { data: txIns, error: txErr } = await supabase
      .from('bank_card_transactions')
      .insert({
        bank_card_id: bankCardId,
        transaction_type: 'deposit',
        amount,
        balance_after: newBal,
        description,
        reference_type: isCheque ? 'cheque_pending' : 'customer_receipt',
        reference_id: submission.id,
        created_by: reviewerId,
        report_date: effectiveDate,
        created_at: effectiveDate,
      } as any)
      .select('id')
      .single();
    if (txErr) throw txErr;
    transactionId = txIns?.id || null;
  }

  // Cheque record
  let chequeId: string | null = null;
  if (isCheque) {
    const { data: chIns } = await supabase
      .from('cheques')
      .insert({
        statement_id: submission.statement_id,
        customer_id: submission.customer_id,
        bank_card_id: bankCardId,
        transaction_id: transactionId,
        amount,
        serial_number: submission.cheque_serial || `SUB-${submission.id.slice(0, 8)}`,
        received_date: submission.created_at,
        due_date: submission.cheque_due_date || nowIso,
        status: 'pending',
        order_payment_ids: insertedPaymentIds,
        notes: submission.notes || null,
        image_url: null,
        created_by: reviewerId,
      } as any)
      .select('id')
      .single();
    chequeId = chIns?.id || null;
  }

  await supabase.from('payment_submissions').update({
    status: 'approved',
    reviewed_by: reviewerId,
    reviewed_at: nowIso,
    review_notes: reviewNotes || null,
    bank_card_id: bankCardId,
    order_payment_ids: insertedPaymentIds,
    transaction_id: transactionId,
    cheque_id: chequeId,
  } as any).eq('id', submission.id);

  if (bankCardId) {
    await recalculateBankCardBalance(bankCardId);
    window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
  }
}

export async function rejectPaymentSubmission(submissionId: string, reviewerId: string, reason?: string) {
  const { error } = await supabase.from('payment_submissions').update({
    status: 'rejected',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_notes: reason || null,
  } as any).eq('id', submissionId);
  if (error) throw error;
}
