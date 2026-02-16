import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Banknote, User, Plus, History, Calendar, FileText, Wallet, CreditCard, Pencil, Trash2, Check, X } from 'lucide-react';
import { formatPersianDateTimeFull } from '@/lib/dateUtils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { sendOrderSms, sendCeoNotificationSms, buildOrderSmsAddress } from '@/lib/orderSms';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  payment_date: string | null;
  paid_by_name?: string;
  bank_card_id?: string | null;
}

interface MultiPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerId: string;
  totalPrice: number | null;
  onPaymentSuccess?: () => void;
  customerPhone?: string;
  address?: string;
  serviceType?: string;
}

export function MultiPaymentDialog({
  open,
  onOpenChange,
  orderId,
  orderCode,
  customerName,
  customerId,
  totalPrice,
  onPaymentSuccess,
  customerPhone,
  address,
  serviceType
}: MultiPaymentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedBankCardId, setSelectedBankCardId] = useState<string | null>(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString());

  // Edit state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editReceiptNumber, setEditReceiptNumber] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBankCardId, setEditBankCardId] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editPaymentDate, setEditPaymentDate] = useState<string>(new Date().toISOString());

  // Delete state
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      fetchPayments();
      setPaymentDate(new Date().toISOString());
    }
  }, [open, orderId]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_payments')
        .select('id, amount, payment_method, receipt_number, notes, created_at, paid_by, bank_card_id, payment_date')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const paymentsWithNames = await Promise.all(
        (data || []).map(async (payment) => {
          let paid_by_name = '';
          if (payment.paid_by) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', payment.paid_by)
              .maybeSingle();
            paid_by_name = profileData?.full_name || 'نامشخص';
          }
          return {
            ...payment,
            amount: Number(payment.amount),
            paid_by_name,
            payment_date: (payment as any).payment_date || payment.created_at
          };
        })
      );

      setPayments(paymentsWithNames);
      const total = paymentsWithNames.reduce((sum, p) => sum + p.amount, 0);
      setTotalPaid(total);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'دریافت تاریخچه پرداخت‌ها با خطا مواجه شد'
      });
    } finally {
      setLoading(false);
    }
  };

  /** Sync total_paid on projects_v3 after add/edit/delete */
  const syncOrderTotalPaid = async (newTotalPaid: number) => {
    const nowIso = new Date().toISOString();
    const isSettledNow = !!totalPrice && totalPrice > 0 && newTotalPaid >= totalPrice;

    const updatePayload: Record<string, any> = {
      total_paid: newTotalPaid,
      updated_at: nowIso,
    };

    if (isSettledNow) {
      updatePayload.payment_confirmed_at = nowIso;
      updatePayload.payment_confirmed_by = user?.id;
      const { data: currentOrder } = await supabase
        .from('projects_v3')
        .select('execution_stage, status')
        .eq('id', orderId)
        .maybeSingle();
      if (currentOrder?.status !== 'closed') {
        updatePayload.status = 'paid';
      }
      if (currentOrder?.execution_stage === 'awaiting_payment') {
        updatePayload.execution_stage = 'awaiting_collection';
        updatePayload.execution_stage_updated_at = nowIso;
      }
    } else {
      updatePayload.payment_confirmed_at = null;
      updatePayload.payment_confirmed_by = null;
      const { data: currentOrder } = await supabase
        .from('projects_v3')
        .select('status, execution_stage')
        .eq('id', orderId)
        .maybeSingle();
      if (currentOrder?.status === 'paid') {
        updatePayload.status = 'active';
      }
      if (currentOrder?.execution_stage === 'awaiting_collection') {
        updatePayload.execution_stage = 'awaiting_payment';
        updatePayload.execution_stage_updated_at = nowIso;
      }
    }

    await supabase.from('projects_v3').update(updatePayload).eq('id', orderId);
  };

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount.replace(/,/g, ''));
    
    if (!paymentAmount || amount <= 0) {
      toast({ variant: 'destructive', title: 'خطا', description: 'لطفاً مبلغ پرداختی را وارد کنید' });
      return;
    }

    const priceIsSet = totalPrice !== null && totalPrice !== undefined && totalPrice > 0;
    if (priceIsSet) {
      const currentRemaining = totalPrice - totalPaid;
      if (amount > currentRemaining) {
        toast({ variant: 'destructive', title: 'خطا', description: `مبلغ پرداختی نمی‌تواند بیشتر از باقی‌مانده (${currentRemaining.toLocaleString('fa-IR')} تومان) باشد` });
        return;
      }
    }

    if (!user?.id) {
      toast({ variant: 'destructive', title: 'خطا', description: 'لطفاً ابتدا وارد سیستم شوید' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: insertedPayment, error: paymentError } = await supabase
        .from('order_payments')
        .insert({
          order_id: orderId,
          amount,
          payment_method: selectedBankCardId ? 'card_transfer' : 'cash',
          receipt_number: receiptNumber || null,
          notes: notes || (selectedBankCardId ? 'واریز به کارت بانکی' : 'پرداخت نقدی / علی‌الحساب'),
          paid_by: user.id,
          bank_card_id: selectedBankCardId || null,
          payment_date: paymentDate,
        } as any)
        .select('id')
        .single();

      if (paymentError) throw new Error(`خطا در ثبت پرداخت: ${paymentError.message}`);
      if (!insertedPayment) throw new Error('پرداخت ثبت نشد');

      const newTotalPaid = totalPaid + amount;
      await syncOrderTotalPaid(newTotalPaid);

      // Update bank card balance if selected
      if (selectedBankCardId) {
        try {
          const { data: cardData } = await supabase
            .from('bank_cards')
            .select('current_balance')
            .eq('id', selectedBankCardId)
            .single();

          if (cardData) {
            const newCardBalance = Number(cardData.current_balance) + amount;
            await supabase.from('bank_card_transactions').insert({
              bank_card_id: selectedBankCardId,
              transaction_type: 'deposit',
              amount,
              balance_after: newCardBalance,
              description: `واریز پرداخت سفارش ${orderCode} - ${customerName}`,
              reference_type: 'order_payment',
              reference_id: insertedPayment.id,
              created_by: user.id,
              report_date: paymentDate || null,
            });
            await supabase.from('bank_cards').update({ current_balance: newCardBalance, updated_at: new Date().toISOString() }).eq('id', selectedBankCardId);
            window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
          }
        } catch (cardError) {
          console.error('Error updating bank card balance:', cardError);
        }
      }

      // Notifications
      if (customerId) {
        const { data: customerData } = await supabase.from('customers').select('user_id').eq('id', customerId).maybeSingle();
        if (customerData?.user_id) {
          const remaining = (totalPrice || 0) - newTotalPaid;
          await supabase.from('notifications').insert({
            user_id: customerData.user_id,
            title: 'پرداخت ثبت شد ✓',
            body: remaining > 0 
              ? `مبلغ ${amount.toLocaleString('fa-IR')} تومان برای سفارش ${orderCode} ثبت شد. مانده: ${remaining.toLocaleString('fa-IR')} تومان`
              : `مبلغ ${amount.toLocaleString('fa-IR')} تومان برای سفارش ${orderCode} ثبت شد. سفارش تسویه شد.`,
            link: `/user/my-orders`,
            type: 'success'
          });
        }
      }
      if (customerPhone) {
        sendOrderSms(customerPhone, orderCode, 'paid', { orderId, serviceType: serviceType || 'خدمات', address: address || 'ثبت نشده', amount });
      }
      sendCeoNotificationSms(orderCode, 'paid', { orderId, serviceType: serviceType || 'خدمات', address: address || 'ثبت نشده', amount, customerName });

      toast({ title: '✓ پرداخت ثبت شد', description: `مبلغ ${amount.toLocaleString('fa-IR')} تومان با موفقیت ثبت شد` });

      setPaymentAmount('');
      setReceiptNumber('');
      setNotes('');
      setSelectedBankCardId(null);
      setPaymentDate(new Date().toISOString());
      fetchPayments();
      onPaymentSuccess?.();
    } catch (error: any) {
      console.error('Error adding payment:', error);
      toast({ variant: 'destructive', title: 'خطا در ثبت پرداخت', description: error.message || 'ثبت پرداخت با خطا مواجه شد.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- EDIT ----
  const startEdit = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    setEditAmount(payment.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    setEditReceiptNumber(payment.receipt_number || '');
    setEditNotes(payment.notes || '');
    setEditBankCardId(payment.bank_card_id || null);
    setEditPaymentDate(payment.payment_date || payment.created_at);
  };

  const cancelEdit = () => {
    setEditingPaymentId(null);
    setEditAmount('');
    setEditReceiptNumber('');
    setEditNotes('');
    setEditBankCardId(null);
    setEditPaymentDate(new Date().toISOString());
  };

  const handleEditPayment = async (payment: Payment) => {
    const newAmount = parseFloat(editAmount.replace(/,/g, ''));
    if (!newAmount || newAmount <= 0) {
      toast({ variant: 'destructive', title: 'خطا', description: 'مبلغ معتبر وارد کنید' });
      return;
    }

    const otherPaymentsTotal = totalPaid - payment.amount;
    const newTotalPaid = otherPaymentsTotal + newAmount;
    const priceIsSet = totalPrice !== null && totalPrice !== undefined && totalPrice > 0;
    if (priceIsSet && newTotalPaid > totalPrice) {
      toast({ variant: 'destructive', title: 'خطا', description: `مبلغ جدید بیشتر از باقی‌مانده مجاز است` });
      return;
    }

    setEditSubmitting(true);
    try {
      const amountDiff = newAmount - payment.amount;

      const oldBankCardId = payment.bank_card_id || null;
      const newBankCardId = editBankCardId;
      const bankCardChanged = oldBankCardId !== newBankCardId;

      // Update payment record
      const { error } = await supabase
        .from('order_payments')
        .update({
          amount: newAmount,
          receipt_number: editReceiptNumber || null,
          notes: editNotes || null,
          bank_card_id: newBankCardId,
          payment_method: newBankCardId ? 'card_transfer' : 'cash',
          payment_date: editPaymentDate,
        } as any)
        .eq('id', payment.id);

      if (error) throw error;

      // Sync order total_paid
      await syncOrderTotalPaid(newTotalPaid);

      // Always handle bank card transactions robustly during edit
      // 1. Delete any existing bank card transaction for this payment (from old or new card)
      const { data: existingTx } = await supabase
        .from('bank_card_transactions')
        .select('id, bank_card_id')
        .eq('reference_type', 'order_payment')
        .eq('reference_id', payment.id);

      const affectedCardIds = new Set<string>();

      if (existingTx && existingTx.length > 0) {
        for (const tx of existingTx) {
          affectedCardIds.add(tx.bank_card_id);
        }
        await supabase
          .from('bank_card_transactions')
          .delete()
          .eq('reference_type', 'order_payment')
          .eq('reference_id', payment.id);
      }

      // Also track old card if it had one but no transaction was found (legacy data)
      if (oldBankCardId) {
        affectedCardIds.add(oldBankCardId);
      }

      // 2. Insert new bank card transaction if a card is selected
      if (newBankCardId) {
        const { data: cardData } = await supabase
          .from('bank_cards')
          .select('current_balance')
          .eq('id', newBankCardId)
          .single();

        if (cardData) {
          const newCardBalance = Number(cardData.current_balance) + newAmount;
          await supabase.from('bank_card_transactions').insert({
            bank_card_id: newBankCardId,
            transaction_type: 'deposit',
            amount: newAmount,
            balance_after: newCardBalance,
            description: `واریز پرداخت سفارش ${orderCode} - ${customerName}`,
            reference_type: 'order_payment',
            reference_id: payment.id,
            created_by: user?.id,
            report_date: editPaymentDate || null,
          });
        }
        affectedCardIds.add(newBankCardId);
      }

      // 3. Recalculate balance for all affected cards
      for (const cardId of affectedCardIds) {
        await recalculateBankCardBalance(cardId);
      }

      if (affectedCardIds.size > 0) {
        window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
      }

      toast({ title: '✓ پرداخت ویرایش شد', description: `مبلغ به ${newAmount.toLocaleString('fa-IR')} تومان تغییر یافت` });
      cancelEdit();
      fetchPayments();
      onPaymentSuccess?.();
    } catch (error: any) {
      console.error('Error editing payment:', error);
      toast({ variant: 'destructive', title: 'خطا', description: 'ویرایش پرداخت با خطا مواجه شد' });
    } finally {
      setEditSubmitting(false);
    }
  };

  // ---- DELETE ----
  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setDeleteSubmitting(true);
    try {
      const payment = deletingPayment;

      // If payment had a bank card, remove the linked transaction & recalculate
      if (payment.bank_card_id) {
        await supabase
          .from('bank_card_transactions')
          .delete()
          .eq('reference_type', 'order_payment')
          .eq('reference_id', payment.id);
      }

      // Delete the payment
      const { error } = await supabase
        .from('order_payments')
        .delete()
        .eq('id', payment.id);

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }

      // Sync order total_paid
      const newTotalPaid = totalPaid - payment.amount;
      await syncOrderTotalPaid(Math.max(0, newTotalPaid));

      // Recalculate bank card if needed
      if (payment.bank_card_id) {
        await recalculateBankCardBalance(payment.bank_card_id);
        window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
      }

      toast({ title: '✓ پرداخت حذف شد', description: `مبلغ ${payment.amount.toLocaleString('fa-IR')} تومان حذف شد` });
      setDeletingPayment(null);
      fetchPayments();
      onPaymentSuccess?.();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({ variant: 'destructive', title: 'خطا در حذف', description: error.message || 'حذف پرداخت با خطا مواجه شد' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const hasPriceSet = totalPrice !== null && totalPrice !== undefined && totalPrice > 0;
  const remainingAmount = hasPriceSet ? (totalPrice - totalPaid) : Infinity;
  const displayRemaining = hasPriceSet ? remainingAmount : null;
  const isSettled = hasPriceSet && remainingAmount <= 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              ثبت پرداخت - سفارش {orderCode}
            </DialogTitle>
            <DialogDescription>
              ثبت پرداخت‌های نقدی برای این سفارش
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Info */}
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                <User className="h-4 w-4" />
                <span>مشتری: {customerName}</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                <p className="text-xs text-muted-foreground mb-1">مبلغ کل</p>
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  {totalPrice ? totalPrice.toLocaleString('fa-IR') : '—'}
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
                <p className="text-xs text-muted-foreground mb-1">پرداخت شده</p>
                <p className="font-bold text-green-600 dark:text-green-400">
                  {totalPaid > 0 ? totalPaid.toLocaleString('fa-IR') : '۰'}
                </p>
                {totalPaid > 0 && !isSettled && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">علی‌الحساب</p>
                )}
              </div>
              <div className={`p-3 rounded-lg border text-center ${
                !isSettled 
                  ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' 
                  : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
              }`}>
                <p className="text-xs text-muted-foreground mb-1">مانده</p>
                <p className={`font-bold ${!isSettled ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isSettled 
                    ? 'تسویه' 
                    : displayRemaining !== null 
                      ? displayRemaining.toLocaleString('fa-IR')
                      : '—'}
                </p>
              </div>
            </div>

            <Separator />

            {/* New Payment Form */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                ثبت پرداخت جدید
              </h4>
              
              <div>
                <Label htmlFor="payment-amount">مبلغ پرداختی (تومان) *</Label>
                <Input
                  id="payment-amount"
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/[^0-9]/g, '');
                    const numericValue = parseInt(rawValue) || 0;
                    let limitedValue = numericValue;
                    if (hasPriceSet && remainingAmount !== Infinity) {
                      const maxAllowed = remainingAmount > 0 ? remainingAmount : 0;
                      limitedValue = Math.min(numericValue, maxAllowed);
                    }
                    const formattedValue = limitedValue > 0 
                      ? limitedValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                      : '';
                    setPaymentAmount(formattedValue);
                  }}
                  placeholder="مبلغ را وارد کنید"
                  className="mt-1.5"
                  dir="ltr"
                  disabled={isSettled}
                />
                {!hasPriceSet ? (
                  <p className="text-xs text-amber-600 mt-1">قیمت سفارش هنوز تعیین نشده - هر مبلغی قابل ثبت است</p>
                ) : !isSettled ? (
                  <p className="text-xs text-muted-foreground mt-1">حداکثر مبلغ قابل ثبت: {remainingAmount.toLocaleString('fa-IR')} تومان</p>
                ) : (
                  <p className="text-xs text-green-600 mt-1">این سفارش تسویه شده است</p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  تاریخ واریز
                </Label>
                <div className="mt-1.5">
                  <PersianDatePicker
                    value={paymentDate}
                    onChange={(date) => date && setPaymentDate(date)}
                    disabled={isSettled}
                  />
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  واریز به کارت بانکی (اختیاری)
                </Label>
                <div className="mt-1.5">
                  <BankCardSelect
                    value={selectedBankCardId}
                    onValueChange={setSelectedBankCardId}
                    placeholder="انتخاب کارت بانکی"
                    disabled={isSettled}
                    showBalance={true}
                    showManagementCards={true}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">با انتخاب کارت، مبلغ پرداختی به موجودی آن اضافه می‌شود</p>
              </div>

              <div>
                <Label htmlFor="receipt-number">شماره رسید (اختیاری)</Label>
                <Input id="receipt-number" type="text" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="شماره رسید یا فیش" className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="payment-notes">توضیحات (اختیاری)</Label>
                <Input id="payment-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً: علی‌الحساب، پرداخت نقدی" className="mt-1.5" />
              </div>

              <Button onClick={handleAddPayment} disabled={submitting || !paymentAmount || isSettled} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                <Wallet className="h-4 w-4" />
                {submitting ? 'در حال ثبت...' : 'ثبت پرداخت'}
              </Button>
            </div>

            <Separator />

            {/* Payment History */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                تاریخچه پرداخت‌ها ({payments.length})
              </h4>
              
              {loading ? (
                <div className="text-center text-sm text-muted-foreground py-4">در حال بارگذاری...</div>
              ) : payments.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4 bg-muted/50 rounded-lg">هنوز پرداختی ثبت نشده است</div>
              ) : (
                <ScrollArea className="h-56">
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="p-3 bg-muted/50 rounded-lg border text-sm">
                        {editingPaymentId === payment.id ? (
                          /* Edit Mode */
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">مبلغ (تومان)</Label>
                              <Input
                                type="text"
                                value={editAmount}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9]/g, '');
                                  const num = parseInt(raw) || 0;
                                  setEditAmount(num > 0 ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '');
                                }}
                                className="mt-1 h-8 text-sm"
                                dir="ltr"
                              />
                            </div>
                            <div>
                              <Label className="text-xs flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                تاریخ واریز
                              </Label>
                              <div className="mt-1">
                                <PersianDatePicker
                                  value={editPaymentDate}
                                  onChange={(date) => date && setEditPaymentDate(date)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                کارت بانکی
                              </Label>
                              <div className="mt-1">
                                <BankCardSelect
                                  value={editBankCardId}
                                  onValueChange={setEditBankCardId}
                                  placeholder="انتخاب کارت بانکی"
                                  showBalance={true}
                                  showManagementCards={true}
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">شماره رسید</Label>
                              <Input type="text" value={editReceiptNumber} onChange={(e) => setEditReceiptNumber(e.target.value)} className="mt-1 h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">توضیحات</Label>
                              <Input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="mt-1 h-8 text-sm" />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={editSubmitting} className="h-7 px-2 text-xs">
                                <X className="h-3 w-3 ml-1" /> انصراف
                              </Button>
                              <Button size="sm" onClick={() => handleEditPayment(payment)} disabled={editSubmitting || !editAmount} className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700">
                                <Check className="h-3 w-3 ml-1" /> {editSubmitting ? 'ذخیره...' : 'ذخیره'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1">
                              <p className="font-bold text-green-600">
                                {payment.amount.toLocaleString('fa-IR')} تومان
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatPersianDateTimeFull(payment.payment_date || payment.created_at)}
                              </div>
                              {payment.paid_by_name && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  ثبت توسط: {payment.paid_by_name}
                                </div>
                              )}
                              {payment.receipt_number && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <FileText className="h-3 w-3" />
                                  {payment.receipt_number}
                                </div>
                              )}
                              {payment.notes && (
                                <p className="text-xs text-muted-foreground">{payment.notes}</p>
                              )}
                            </div>
                            <div className="flex gap-1 mr-2 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(payment)} title="ویرایش">
                                <Pencil className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingPayment(payment)} title="حذف">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>بستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPayment} onOpenChange={(open) => { if (!open && !deleteSubmitting) setDeletingPayment(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف پرداخت</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف پرداخت به مبلغ {deletingPayment?.amount.toLocaleString('fa-IR')} تومان اطمینان دارید؟ این عملیات قابل بازگشت نیست و مانده حساب سفارش و موجودی کارت بانکی بروزرسانی خواهد شد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={deleteSubmitting}>انصراف</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeletePayment}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? 'در حال حذف...' : 'حذف پرداخت'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
