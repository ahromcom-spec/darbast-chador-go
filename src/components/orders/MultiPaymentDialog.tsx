import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Banknote, User, Plus, History, Calendar, FileText, Wallet, CreditCard } from 'lucide-react';
import { formatPersianDateTimeFull } from '@/lib/dateUtils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { sendOrderSms, sendCeoNotificationSms, buildOrderSmsAddress } from '@/lib/orderSms';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  receipt_number: string | null;
  notes: string | null;
  created_at: string;
  paid_by_name?: string;
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

  useEffect(() => {
    if (open && orderId) {
      fetchPayments();
    }
  }, [open, orderId]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_payments')
        .select('id, amount, payment_method, receipt_number, notes, created_at, paid_by')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch paid_by names
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
            paid_by_name
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

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount.replace(/,/g, ''));
    
    if (!paymentAmount || amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً مبلغ پرداختی را وارد کنید'
      });
      return;
    }

    // بررسی که مبلغ پرداختی بیشتر از باقی‌مانده نباشد (فقط اگر قیمت تعیین شده باشد)
    const priceIsSet = totalPrice !== null && totalPrice !== undefined && totalPrice > 0;
    if (priceIsSet) {
      const currentRemaining = totalPrice - totalPaid;
      if (amount > currentRemaining) {
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: `مبلغ پرداختی نمی‌تواند بیشتر از باقی‌مانده (${currentRemaining.toLocaleString('fa-IR')} تومان) باشد`
        });
        return;
      }
    }

    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً ابتدا وارد سیستم شوید'
      });
      return;
    }

    setSubmitting(true);
    try {

      // Insert payment record
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
        })
        .select('id')
        .single();

      if (paymentError) {
        console.error('Payment insert error:', paymentError);
        throw new Error(`خطا در ثبت پرداخت: ${paymentError.message}`);
      }

      if (!insertedPayment) {
        throw new Error('پرداخت ثبت نشد - لطفاً دوباره تلاش کنید');
      }

      // Update total_paid in projects_v3
      const newTotalPaid = totalPaid + amount;
      const nowIso = new Date().toISOString();

      // فقط وقتی سفارش واقعاً تسویه شد payment_confirmed_at ثبت شود
      const isSettled = !!totalPrice && newTotalPaid >= (totalPrice || 0);
      const updatePayload: Record<string, any> = {
        total_paid: newTotalPaid,
        payment_method: 'cash',
        updated_at: nowIso,
      };

      if (isSettled) {
        updatePayload.payment_confirmed_at = nowIso;
        updatePayload.payment_confirmed_by = user.id;
      }

      const { error: updateError } = await supabase
        .from('projects_v3')
        .update(updatePayload)
        .eq('id', orderId);

      if (updateError) {
        console.error('Order update error:', updateError);
        // Still continue - payment was recorded
      }

      // Update bank card balance if a card was selected (deposit)
      if (selectedBankCardId) {
        try {
          // Get current card balance
          const { data: cardData } = await supabase
            .from('bank_cards')
            .select('current_balance')
            .eq('id', selectedBankCardId)
            .single();

          if (cardData) {
            const newCardBalance = Number(cardData.current_balance) + amount;

            // Insert bank card transaction
            await supabase.from('bank_card_transactions').insert({
              bank_card_id: selectedBankCardId,
              transaction_type: 'deposit',
              amount,
              balance_after: newCardBalance,
              description: `واریز پرداخت سفارش ${orderCode} - ${customerName}`,
              reference_type: 'order_payment',
              reference_id: insertedPayment.id,
              created_by: user.id,
            });

            // Update card balance
            await supabase
              .from('bank_cards')
              .update({ current_balance: newCardBalance, updated_at: new Date().toISOString() })
              .eq('id', selectedBankCardId);
          }
        } catch (cardError) {
          console.error('Error updating bank card balance:', cardError);
          // Don't fail the whole payment for this
        }
      }

      // Send notification to customer
      if (customerId) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', customerId)
          .maybeSingle();

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

      // ارسال پیامک به مشتری
      if (customerPhone) {
        sendOrderSms(customerPhone, orderCode, 'paid', {
          orderId,
          serviceType: serviceType || 'خدمات',
          address: address || 'ثبت نشده',
          amount
        });
      }

      // ارسال پیامک به مدیرعامل
      sendCeoNotificationSms(orderCode, 'paid', {
        orderId,
        serviceType: serviceType || 'خدمات',
        address: address || 'ثبت نشده',
        amount,
        customerName
      });

      toast({
        title: '✓ پرداخت ثبت شد',
        description: `مبلغ ${amount.toLocaleString('fa-IR')} تومان با موفقیت ثبت شد`
      });

      // Reset form
      setPaymentAmount('');
      setReceiptNumber('');
      setNotes('');
      setSelectedBankCardId(null);
      
      // Refresh payments
      fetchPayments();
      onPaymentSuccess?.();
    } catch (error: any) {
      console.error('Error adding payment:', error);
      toast({
        variant: 'destructive',
        title: 'خطا در ثبت پرداخت',
        description: error.message || 'ثبت پرداخت با خطا مواجه شد. لطفاً دوباره تلاش کنید.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // اگر totalPrice صفر یا تعیین نشده باشد، مانده را نامحدود در نظر بگیر (امکان ثبت پرداخت بدون قیمت مشخص)
  const hasPriceSet = totalPrice !== null && totalPrice !== undefined && totalPrice > 0;
  const remainingAmount = hasPriceSet ? (totalPrice - totalPaid) : Infinity;
  const displayRemaining = hasPriceSet ? remainingAmount : null;
  const isSettled = hasPriceSet && remainingAmount <= 0;

  return (
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
                  // فقط اعداد مجاز - حذف همه کاراکترها غیر عددی
                  const rawValue = e.target.value.replace(/[^0-9]/g, '');
                  const numericValue = parseInt(rawValue) || 0;
                  
                  // اگر قیمت تعیین شده، محدود به باقی‌مانده، در غیر این صورت نامحدود
                  let limitedValue = numericValue;
                  if (hasPriceSet && remainingAmount !== Infinity) {
                    const maxAllowed = remainingAmount > 0 ? remainingAmount : 0;
                    limitedValue = Math.min(numericValue, maxAllowed);
                  }
                  
                  // فرمت سه رقم سه رقم با کاما
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
                <p className="text-xs text-amber-600 mt-1">
                  قیمت سفارش هنوز تعیین نشده - هر مبلغی قابل ثبت است
                </p>
              ) : !isSettled ? (
                <p className="text-xs text-muted-foreground mt-1">
                  حداکثر مبلغ قابل ثبت: {remainingAmount.toLocaleString('fa-IR')} تومان
                </p>
              ) : (
                <p className="text-xs text-green-600 mt-1">
                  این سفارش تسویه شده است
                </p>
              )}
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
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                با انتخاب کارت، مبلغ پرداختی به موجودی آن اضافه می‌شود
              </p>
            </div>

            <div>
              <Label htmlFor="receipt-number">شماره رسید (اختیاری)</Label>
              <Input
                id="receipt-number"
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="شماره رسید یا فیش"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="payment-notes">توضیحات (اختیاری)</Label>
              <Input
                id="payment-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثلاً: علی‌الحساب، پرداخت نقدی"
                className="mt-1.5"
              />
            </div>

            <Button 
              onClick={handleAddPayment} 
              disabled={submitting || !paymentAmount || isSettled}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
            >
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
              <div className="text-center text-sm text-muted-foreground py-4">
                در حال بارگذاری...
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4 bg-muted/50 rounded-lg">
                هنوز پرداختی ثبت نشده است
              </div>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className="p-3 bg-muted/50 rounded-lg border text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-bold text-green-600">
                            {payment.amount.toLocaleString('fa-IR')} تومان
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatPersianDateTimeFull(payment.created_at)}
                          </div>
                          {payment.paid_by_name && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              ثبت توسط: {payment.paid_by_name}
                            </div>
                          )}
                        </div>
                        <div className="text-left space-y-1">
                          {payment.receipt_number && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {payment.receipt_number}
                            </div>
                          )}
                          {payment.notes && (
                            <p className="text-xs text-muted-foreground max-w-32 truncate">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            بستن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
