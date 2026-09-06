import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Banknote, CreditCard, FileCheck, Image as ImageIcon, X, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { uploadPaymentImage } from '@/lib/paymentSubmissions';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { formatPersianDate } from '@/lib/dateUtils';
import { buildGroupPaymentSummary } from '@/lib/paymentNoteFormat';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';

interface OrderLite {
  id: string;
  code: string;
  total: number;
  paid: number;
  remaining: number;
  created_at: string;
  /** Optional explicit waterfall ordering key (e.g. statement number + date) */
  sortKey?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  statementId: string;
  statementNumber: number;
  customerId: string;
  customerName: string | null;
  orders: OrderLite[];
  onSuccess?: () => void;
  /** Label shown instead of "صورتحساب شماره X" (used for the all-statements payment) */
  scopeLabel?: string;
}


const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type PayMode = 'cash' | 'cheque';

export function StatementManualPaymentDialog({
  open, onOpenChange, statementId, statementNumber, customerId, customerName, orders, onSuccess, scopeLabel,
}: Props) {

  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<PayMode>('cash');
  const [amountInput, setAmountInput] = useState('');
  const [bankCardId, setBankCardId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString());
  const [receipt, setReceipt] = useState('');
  const [receiptImageFile, setReceiptImageFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showError = (title: string, description: string) => {
    setFormError(`${title} — ${description}`);
    toast({ title, description, variant: 'destructive' });
  };

  // Cheque-specific fields
  const [chequeSerial, setChequeSerial] = useState('');
  const [chequeReceivedDate, setChequeReceivedDate] = useState<string>(new Date().toISOString());
  const [chequeDueDate, setChequeDueDate] = useState<string>(new Date().toISOString());
  const [chequeImageFile, setChequeImageFile] = useState<File | null>(null);
  const [chequeImagePreview, setChequeImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const totalRemaining = orders.reduce((a, o) => a + o.remaining, 0);

  useEffect(() => {
    if (open) {
      setMode('cash');
      setAmountInput(String(Math.round(totalRemaining || 0)));
      setBankCardId(null);
      setReceipt('');
      setNotes('');
      setPaymentDate(new Date().toISOString());
      setChequeSerial('');
      setChequeReceivedDate(new Date().toISOString());
      setChequeDueDate(new Date().toISOString());
      setChequeImageFile(null);
      setChequeImagePreview(null);
      setUploadingImage(false);
      setFormError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setFormError(null);
    const amount = Math.round(parseLocalizedNumber(amountInput));
    if (!amount || amount <= 0) {
      showError('مبلغ نامعتبر', 'لطفاً مبلغ معتبری وارد کنید');
      return;
    }
    if (!user?.id) {
      showError('خطای ورود', 'ابتدا وارد سیستم شوید');
      return;
    }
    if (orders.length === 0) {
      showError('بدون سفارش', 'این صورتحساب سفارشی ندارد');
      return;
    }
    if (mode === 'cheque') {
      if (!chequeSerial.trim()) {
        showError('شماره سریال چک الزامی است', 'لطفاً شماره سریال روی چک را وارد کنید');
        return;
      }
      if (!bankCardId) {
        showError('کارت بانکی الزامی است', 'برای ثبت چک، انتخاب کارت بانکی الزامی است');
        return;
      }
    }

    setSubmitting(true);
    try {
      const sorted = [...orders].sort((a, b) =>
        (a.sortKey || a.created_at).localeCompare(b.sortKey || b.created_at)
      );

      let remaining = amount;
      const allocations: { order: OrderLite; portion: number }[] = [];

      for (let i = 0; i < sorted.length; i++) {
        const o = sorted[i];
        if (remaining <= 0) break;
        const isLast = i === sorted.length - 1;
        const take = isLast ? remaining : Math.min(remaining, Math.max(0, o.remaining));
        if (take > 0) {
          allocations.push({ order: o, portion: take });
          remaining -= take;
        }
      }
      if (allocations.length === 0 && sorted.length > 0) {
        allocations.push({ order: sorted[sorted.length - 1], portion: amount });
      }

      const isCheque = mode === 'cheque';

      // Dedupe: if a cheque with this statement+serial already exists, remove its prior
      // bank_card_transactions, order_payments and the cheque row so we replace cleanly.
      if (isCheque && chequeSerial.trim()) {
        const { data: existingCheques } = await supabase
          .from('cheques')
          .select('id, transaction_id, order_payment_ids')
          .eq('statement_id', statementId)
          .eq('serial_number', chequeSerial.trim());
        const oldTxIds: string[] = [];
        const oldPayIds: string[] = [];
        const oldChequeIds: string[] = [];
        for (const c of (existingCheques || []) as any[]) {
          oldChequeIds.push(c.id);
          if (c.transaction_id) oldTxIds.push(c.transaction_id);
          if (Array.isArray(c.order_payment_ids)) oldPayIds.push(...c.order_payment_ids.filter(Boolean));
        }
        const { data: txByDesc } = await supabase
          .from('bank_card_transactions')
          .select('id')
          .in('reference_type', ['cheque_pending', 'cheque_cleared'])
          .or(`description.ilike.%CHEQUE:${chequeSerial.trim()}%,description.ilike.%سریال ${chequeSerial.trim()}%`);
        for (const t of (txByDesc || []) as any[]) oldTxIds.push(t.id);
        const oldGroupIds = oldPayIds.length > 0
          ? Array.from(new Set(((await supabase
              .from('order_payments')
              .select('notes')
              .in('id', oldPayIds)).data || [])
              .map((p: any) => String(p.notes || '').match(/\[STMT-GRP:([^\]]+)\]/)?.[1])
              .filter((gid): gid is string => !!gid)))
          : [];
        for (const gid of oldGroupIds) {
          const { data: txByGroup } = await supabase
            .from('bank_card_transactions')
            .select('id')
            .in('reference_type', ['statement_payment', 'cheque_pending', 'cheque_cleared'])
            .ilike('description', `%STMT-GRP:${gid}%`);
          for (const t of (txByGroup || []) as any[]) oldTxIds.push(t.id);
          if (UUID_RE.test(gid)) {
            const { data: txByRef } = await supabase
              .from('bank_card_transactions')
              .select('id')
              .in('reference_type', ['statement_payment', 'cheque_pending', 'cheque_cleared'])
              .eq('reference_id', gid);
            for (const t of (txByRef || []) as any[]) oldTxIds.push(t.id);
          }
        }
        if (oldTxIds.length) await supabase.from('bank_card_transactions').delete().in('id', oldTxIds);
        if (oldPayIds.length) await supabase.from('order_payments').delete().in('id', oldPayIds);
        if (oldChequeIds.length) await supabase.from('cheques').delete().in('id', oldChequeIds);
      }


      const paymentMethod = isCheque ? 'cheque' : (bankCardId ? 'card_transfer' : 'cash');
      const groupId: string = (crypto as any).randomUUID ? (crypto as any).randomUUID() : '';
      const groupTag = groupId ? ` [STMT-GRP:${groupId}]` : '';
      const chequeTag = isCheque ? ` [CHEQUE:${chequeSerial}]` : '';
      const effectiveDate = isCheque ? chequeDueDate : paymentDate;
      const baseNote = notes || (isCheque
        ? `چک شماره ${chequeSerial} — سررسید ${formatPersianDate(chequeDueDate, { dateFormat: 'yyyy/MM/dd' })} (وصول نشده)`
        : (bankCardId ? 'واریز به کارت بانکی (صورتحساب)' : 'پرداخت نقدی / علی‌الحساب (صورتحساب)'));
      const affectedCards = new Set<string>();
      const insertedPaymentIds: string[] = [];

      // آپلود عکس فیش واریزی (حالت نقدی/کارت به کارت)
      let receiptImagePath: string | null = null;
      if (!isCheque && receiptImageFile) {
        setUploadingImage(true);
        try {
          receiptImagePath = await uploadPaymentImage(receiptImageFile, user.id);
        } finally {
          setUploadingImage(false);
        }
      }

      for (const { order, portion } of allocations) {
        const { data: ins, error: insErr } = await supabase
          .from('order_payments')
          .insert({
            order_id: order.id,
            amount: portion,
            payment_method: paymentMethod,
            receipt_number: receipt || (isCheque ? chequeSerial : null),
            notes: `${baseNote} — ${buildGroupPaymentSummary({
              totalAmount: amount,
              portion,
              date: effectiveDate,
              statementNumber,
              method: isCheque ? 'cheque' : (bankCardId ? 'card' : 'cash'),
            })}${groupTag}${chequeTag}`,
            paid_by: user.id,
            bank_card_id: null,
            payment_date: effectiveDate,
            receipt_image_url: receiptImagePath,
          } as any)
          .select('id')
          .single();
        if (insErr) throw insErr;
        if (ins?.id) insertedPaymentIds.push(ins.id);

        // Update order total_paid + status (for cheque too — manager wants the statement marked)
        const newOrderPaid = order.paid + portion;
        const nowIso = new Date().toISOString();
        const updatePayload: Record<string, any> = {
          total_paid: newOrderPaid,
          updated_at: nowIso,
        };
        const fullySettled = order.total > 0 && newOrderPaid >= order.total;
        if (fullySettled && !isCheque) {
          // مرحله اجرایی خودکار تغییر نمی‌کند
          updatePayload.payment_confirmed_at = nowIso;
          updatePayload.payment_confirmed_by = user.id;
        }
        await supabase.from('projects_v3').update(updatePayload).eq('id', order.id);
      }

      let createdTransactionId: string | null = null;

      if (bankCardId && insertedPaymentIds.length > 0) {
        const { data: cardData } = await supabase
          .from('bank_cards')
          .select('current_balance')
          .eq('id', bankCardId)
          .single();
        if (cardData) {
          const newBal = Number(cardData.current_balance) + amount;
          const orderCodes = allocations.map(a => a.order.code).join('، ');
          const txDescription = isCheque
            ? `🟠 چک وصول نشده است — سریال ${chequeSerial} — صورتحساب ${statementNumber} - ${customerName || ''} - سفارش‌های: ${orderCodes}${chequeTag}${groupTag}`
            : `واریز صورتحساب ${statementNumber} - ${customerName || ''} - سفارش‌های: ${orderCodes}${groupTag}`;
          const { data: txIns } = await supabase.from('bank_card_transactions').insert({
            bank_card_id: bankCardId,
            transaction_type: 'deposit',
            amount: amount,
            balance_after: newBal,
            description: txDescription,
            reference_type: isCheque ? 'cheque_pending' : 'statement_payment',
            reference_id: groupId || insertedPaymentIds[0],
            created_by: user.id,
            report_date: effectiveDate || null,
            created_at: effectiveDate || new Date().toISOString(),
          } as any).select('id').single();
          createdTransactionId = txIns?.id || null;
          affectedCards.add(bankCardId);

          await supabase
            .from('order_payments')
            .update({ bank_card_id: bankCardId })
            .in('id', insertedPaymentIds);
        }
      }

      // Create the cheque record
      if (isCheque) {
        // Upload image if provided
        let imageUrl: string | null = null;
        if (chequeImageFile) {
          setUploadingImage(true);
          try {
            const ext = (chequeImageFile.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `${user.id}/${statementId}/${Date.now()}-${chequeSerial.trim() || 'cheque'}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('cheque-images')
              .upload(path, chequeImageFile, { upsert: true, contentType: chequeImageFile.type });
            if (upErr) throw upErr;
            imageUrl = path;
          } finally {
            setUploadingImage(false);
          }
        }

        await supabase.from('cheques').insert({
          statement_id: statementId,
          customer_id: customerId,
          bank_card_id: bankCardId,
          transaction_id: createdTransactionId,
          amount: amount,
          serial_number: chequeSerial,
          received_date: chequeReceivedDate,
          due_date: chequeDueDate,
          status: 'pending',
          order_payment_ids: insertedPaymentIds,
          notes: notes || null,
          image_url: imageUrl,
          created_by: user.id,
        } as any);
      }

      for (const cid of affectedCards) {
        await recalculateBankCardBalance(cid);
      }
      if (affectedCards.size > 0) {
        window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
      }

      toast({
        title: isCheque ? '✓ چک ثبت شد' : '✓ پرداخت ثبت شد',
        description: isCheque
          ? `چک سریال ${chequeSerial} با مبلغ ${new Intl.NumberFormat('fa-IR').format(amount)} تومان در انتظار وصول ثبت شد`
          : `مبلغ ${new Intl.NumberFormat('fa-IR').format(amount)} تومان روی ${allocations.length} سفارش تخصیص یافت`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Statement manual payment error:', err);
      const raw = err?.message || '';
      const fa = /permission|denied|policy/i.test(raw)
        ? 'دسترسی لازم برای ثبت این تراکنش وجود ندارد'
        : /duplicate|unique/i.test(raw)
        ? 'این رکورد قبلاً ثبت شده است (تکراری)'
        : /network|fetch|timeout/i.test(raw)
        ? 'خطا در ارتباط با سرور؛ اتصال اینترنت را بررسی کنید'
        : raw || 'ثبت پرداخت با خطا مواجه شد';
      showError('خطا در ثبت', fa);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            {scopeLabel ? 'ثبت پرداخت کل صورتحساب‌ها' : 'ثبت پرداخت صورتحساب'}
          </DialogTitle>
          <DialogDescription>
            {scopeLabel || `صورتحساب شماره ${new Intl.NumberFormat('fa-IR').format(statementNumber)}`} — مانده فعلی:{' '}
            <span className="font-bold text-red-600">{fmt(totalRemaining)}</span>
          </DialogDescription>

        </DialogHeader>

        {formError && (
          <div
            role="alert"
            className="sticky top-0 z-50 -mx-1 mt-2 rounded-md border-2 border-red-500 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200 font-bold shadow-md flex items-start justify-between gap-2"
          >
            <span className="leading-6">⚠️ {formError}</span>
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="text-red-700 hover:text-red-900 dark:text-red-300 font-bold px-1"
              aria-label="بستن"
            >
              ✕
            </button>
          </div>
        )}


        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            type="button"
            variant={mode === 'cash' ? 'default' : 'outline'}
            className={mode === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2' : 'gap-2'}
            onClick={() => setMode('cash')}
          >
            <Banknote className="h-4 w-4" />
            نقدی / کارت
          </Button>
          <Button
            type="button"
            variant={mode === 'cheque' ? 'default' : 'outline'}
            className={mode === 'cheque' ? 'bg-amber-600 hover:bg-amber-700 text-white gap-2' : 'gap-2'}
            onClick={() => setMode('cheque')}
          >
            <FileCheck className="h-4 w-4" />
            ثبت چک
          </Button>
        </div>

        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="manual-amount">{mode === 'cheque' ? 'مبلغ چک (تومان)' : 'مبلغ پرداخت (تومان)'}</Label>
            <Input
              id="manual-amount"
              dir="ltr"
              inputMode="numeric"
              className="text-right text-lg mt-1"
              value={amountInput ? new Intl.NumberFormat('fa-IR').format(Math.round(parseLocalizedNumber(amountInput) || 0)) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d۰-۹٠-٩]/g, '');
                setAmountInput(raw);
              }}
              placeholder="مبلغ مورد نظر را وارد کنید"
            />
            {mode === 'cash' && (() => {
              const v = Math.round(parseLocalizedNumber(amountInput) || 0);
              const over = v - Math.round(totalRemaining || 0);
              if (over > 0) {
                return (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 leading-5 font-semibold">
                    مبلغ شما {new Intl.NumberFormat('fa-IR').format(over)} تومان بیشتر از مانده است؛ مازاد روی آخرین سفارش به‌عنوان علی‌الحساب ثبت می‌شود.
                  </p>
                );
              }
              return (
                <p className="text-[11px] text-muted-foreground mt-1 leading-5">
                  می‌توانید بیشتر از مانده صورتحساب نیز پرداخت کنید. مبلغ از اولین سفارش به‌ترتیب تخصیص می‌یابد و مازاد روی آخرین سفارش ثبت می‌شود.
                </p>
              );
            })()}
          </div>

          <div>
            <Label className="flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              کارت بانکی {mode === 'cheque' ? '(الزامی)' : '(اختیاری)'}
            </Label>
            <div className="mt-1">
              <BankCardSelect
                value={bankCardId}
                onValueChange={setBankCardId}
                placeholder={mode === 'cheque'
                  ? 'انتخاب کارت — تراکنش چک در این کارت ثبت می‌شود'
                  : 'انتخاب کارت — در صورت انتخاب، در تراکنش کارت ثبت می‌شود'}
                showBalance
                moduleKey="order_payment"
              />
            </div>
          </div>

          {mode === 'cheque' ? (
            <>
              <div>
                <Label htmlFor="cheque-serial">شماره سریال چک</Label>
                <Input
                  id="cheque-serial"
                  value={chequeSerial}
                  onChange={(e) => setChequeSerial(e.target.value)}
                  placeholder="شماره سریال روی چک"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>تاریخ تحویل گرفتن چک</Label>
                <div className="mt-1">
                  <PersianDatePicker value={chequeReceivedDate} onChange={(v) => setChequeReceivedDate(v || new Date().toISOString())} />
                </div>
              </div>
              <div>
                <Label>تاریخ سررسید چک</Label>
                <div className="mt-1">
                  <PersianDatePicker value={chequeDueDate} onChange={(v) => setChequeDueDate(v || new Date().toISOString())} />
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 leading-5">
                  تاریخ تراکنش در کارت بانکی، تاریخ سررسید چک خواهد بود.
                </p>
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  تصویر چک (اختیاری)
                </Label>
                <div className="mt-1">
                  {chequeImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={chequeImagePreview}
                        alt="پیش‌نمایش چک"
                        className="max-h-40 rounded-md border border-border object-contain bg-muted"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (chequeImagePreview) URL.revokeObjectURL(chequeImagePreview);
                          setChequeImageFile(null);
                          setChequeImagePreview(null);
                        }}
                        className="absolute -top-2 -left-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow"
                        aria-label="حذف تصویر"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-md py-3 px-4 hover:bg-muted/50 transition text-sm text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <span>انتخاب یا گرفتن عکس از چک</span>
                      <input
                        type="file"
                        accept="image/*"

                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (!f) return;
                          if (f.size > 10 * 1024 * 1024) {
                            showError('حجم تصویر زیاد است', 'حداکثر حجم مجاز ۱۰ مگابایت است');
                            return;
                          }
                          setChequeImageFile(f);
                          setChequeImagePreview(URL.createObjectURL(f));
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1 leading-5">
                    تصویر چک در «مدیریت چک‌ها» قابل مشاهده خواهد بود.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div>
              <Label>تاریخ پرداخت</Label>
              <div className="mt-1">
                <PersianDatePicker value={paymentDate} onChange={(v) => setPaymentDate(v || new Date().toISOString())} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="manual-receipt">شماره رسید</Label>
              <Input id="manual-receipt" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="اختیاری" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="manual-notes">توضیحات</Label>
              <Input id="manual-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختیاری" className="mt-1" />
            </div>
          </div>

          {mode === 'cash' && (
            <div>
              <Label htmlFor="manual-receipt-image">عکس فیش واریزی (اختیاری)</Label>
              <Input
                id="manual-receipt-image"
                type="file"
                accept="image/*"
                className="mt-1"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f && f.size > 15 * 1024 * 1024) {
                    showError('حجم تصویر زیاد است', 'حداکثر حجم مجاز ۱۵ مگابایت است');
                    return;
                  }
                  setReceiptImageFile(f);
                }}
              />
              {receiptImageFile && (
                <p className="text-[11px] text-emerald-600 mt-1">{receiptImageFile.name}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>انصراف</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className={mode === 'cheque'
              ? 'bg-amber-600 hover:bg-amber-700 text-white gap-2'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2'}
          >
            {mode === 'cheque' ? <FileCheck className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
            {uploadingImage ? 'در حال آپلود تصویر...' : (submitting ? 'در حال ثبت...' : (mode === 'cheque' ? 'ثبت چک' : 'ثبت پرداخت'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
