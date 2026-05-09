import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Banknote, User, Wand2, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { BankCardSelect } from '@/components/bank-cards/BankCardSelect';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface BulkPaymentOrder {
  id: string;
  code: string;
  payment_amount: number;
  total_paid: number;
  remaining: number;
  service_type_name?: string;
  address?: string;
}

interface CustomerBulkPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  orders: BulkPaymentOrder[];
  onSuccess?: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('fa-IR');
const parse = (s: string) => parseFloat((s || '').replace(/,/g, '').replace(/[٬،]/g, '')) || 0;

export function CustomerBulkPaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerPhone,
  orders,
  onSuccess,
}: CustomerBulkPaymentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [totalAmount, setTotalAmount] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [bankCardId, setBankCardId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString());

  // Only orders with remaining > 0
  const debtOrders = useMemo(
    () => orders.filter((o) => o.remaining > 0),
    [orders]
  );

  useEffect(() => {
    if (open) {
      setTotalAmount('');
      setAllocations({});
      setBankCardId(null);
      setReceiptNumber('');
      setNotes('');
      setPaymentDate(new Date().toISOString());
    }
  }, [open]);

  const totalRemaining = debtOrders.reduce((s, o) => s + o.remaining, 0);
  const totalAllocated = debtOrders.reduce(
    (s, o) => s + parse(allocations[o.id] || ''),
    0
  );
  const totalAmountNum = parse(totalAmount);
  const remainingToAllocate = totalAmountNum - totalAllocated;

  const autoDistribute = () => {
    let amt = totalAmountNum;
    if (amt <= 0) {
      toast({ variant: 'destructive', title: 'خطا', description: 'ابتدا مبلغ کل را وارد کنید' });
      return;
    }
    const next: Record<string, string> = {};
    for (const o of debtOrders) {
      if (amt <= 0) {
        next[o.id] = '';
        continue;
      }
      const share = Math.min(amt, o.remaining);
      next[o.id] = String(Math.round(share));
      amt -= share;
    }
    setAllocations(next);
    if (amt > 0) {
      toast({
        title: 'مبلغ بیشتر از بدهی',
        description: `${fmt(amt)} تومان بیش از مجموع بدهی است و توزیع نشد`,
      });
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast({ variant: 'destructive', title: 'خطا', description: 'لطفاً وارد سیستم شوید' });
      return;
    }
    if (totalAmountNum <= 0) {
      toast({ variant: 'destructive', title: 'خطا', description: 'مبلغ کل را وارد کنید' });
      return;
    }
    const items = debtOrders
      .map((o) => ({ order: o, amount: parse(allocations[o.id] || '') }))
      .filter((i) => i.amount > 0);

    if (items.length === 0) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'مبلغ را بین سفارشات توزیع کنید (می‌توانید از دکمه توزیع خودکار استفاده کنید)',
      });
      return;
    }
    for (const it of items) {
      if (it.amount > it.order.remaining) {
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: `سهم سفارش ${it.order.code} نمی‌تواند بیشتر از مانده (${fmt(it.order.remaining)}) باشد`,
        });
        return;
      }
    }
    const sumItems = items.reduce((s, i) => s + i.amount, 0);
    if (Math.abs(sumItems - totalAmountNum) > 1) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: `مجموع سهم سفارشات (${fmt(sumItems)}) با مبلغ کل (${fmt(totalAmountNum)}) برابر نیست`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const affectedCards = new Set<string>();
      for (const it of items) {
        const { order, amount } = it;
        const baseNotes =
          notes ||
          `پرداخت گروهی صورتحساب ${customerName}` +
            (bankCardId ? ' - واریز به کارت بانکی' : '');

        const { data: insertedPayment, error: payErr } = await supabase
          .from('order_payments')
          .insert({
            order_id: order.id,
            amount,
            payment_method: bankCardId ? 'card_transfer' : 'cash',
            receipt_number: receiptNumber || null,
            notes: baseNotes,
            paid_by: user.id,
            bank_card_id: bankCardId || null,
            payment_date: paymentDate,
          } as any)
          .select('id')
          .single();
        if (payErr) throw payErr;

        const newTotalPaid = order.total_paid + amount;
        const isSettled = order.payment_amount > 0 && newTotalPaid >= order.payment_amount;
        const nowIso = new Date().toISOString();
        const updatePayload: Record<string, any> = {
          total_paid: newTotalPaid,
          updated_at: nowIso,
        };
        if (isSettled) {
          updatePayload.payment_confirmed_at = nowIso;
          updatePayload.payment_confirmed_by = user.id;
          const { data: cur } = await supabase
            .from('projects_v3')
            .select('status, execution_stage')
            .eq('id', order.id)
            .maybeSingle();
          if (cur?.status !== 'closed') updatePayload.status = 'paid';
          if (cur?.execution_stage === 'awaiting_payment') {
            updatePayload.execution_stage = 'awaiting_collection';
            updatePayload.execution_stage_updated_at = nowIso;
          }
        }
        await supabase.from('projects_v3').update(updatePayload).eq('id', order.id);

        // Bank card transaction per order share (so audit log shows each order)
        if (bankCardId && insertedPayment) {
          const { data: cardData } = await supabase
            .from('bank_cards')
            .select('current_balance')
            .eq('id', bankCardId)
            .single();
          if (cardData) {
            const newBalance = Number(cardData.current_balance) + amount;
            await supabase.from('bank_card_transactions').insert({
              bank_card_id: bankCardId,
              transaction_type: 'deposit',
              amount,
              balance_after: newBalance,
              description: `واریز پرداخت سفارش ${order.code} - ${customerName}`,
              reference_type: 'order_payment',
              reference_id: insertedPayment.id,
              created_by: user.id,
              report_date: paymentDate || null,
            });
            await supabase
              .from('bank_cards')
              .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
              .eq('id', bankCardId);
            affectedCards.add(bankCardId);
          }
        }
      }

      for (const cid of affectedCards) {
        await recalculateBankCardBalance(cid);
      }
      if (affectedCards.size > 0) {
        window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
      }

      toast({
        title: '✓ پرداخت ثبت شد',
        description: `مبلغ ${fmt(totalAmountNum)} تومان بین ${items.length} سفارش توزیع شد`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      console.error('Bulk payment error:', e);
      toast({ variant: 'destructive', title: 'خطا', description: e.message || 'ثبت پرداخت با خطا مواجه شد' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            ثبت پرداخت کل صورتحساب
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {customerName}
            {customerPhone && <span className="text-muted-foreground">| {customerPhone}</span>}
          </DialogDescription>
        </DialogHeader>

        {debtOrders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            هیچ سفارش بدهکاری برای این مشتری وجود ندارد.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top: amount + bank card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>مبلغ کل پرداختی (تومان)</Label>
                <Input
                  inputMode="numeric"
                  value={totalAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    setTotalAmount(raw ? Number(raw).toLocaleString('en-US') : '');
                  }}
                  placeholder="مثلاً 10,000,000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  مجموع بدهی: {fmt(totalRemaining)} تومان
                </p>
              </div>
              <div>
                <Label>کارت بانکی (در صورت واریز)</Label>
                <BankCardSelect
                  value={bankCardId}
                  onValueChange={setBankCardId}
                  placeholder="پرداخت نقدی / بدون کارت"
                />
              </div>
              <div>
                <Label>شماره فیش / مرجع</Label>
                <Input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
              </div>
              <div>
                <Label>تاریخ پرداخت</Label>
                <PersianDatePicker
                  value={paymentDate}
                  onChange={(iso) => setPaymentDate(iso || new Date().toISOString())}
                />
              </div>
              <div className="md:col-span-2">
                <Label>توضیحات</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختیاری" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <h4 className="font-medium">توزیع بین سفارشات</h4>
              <Button type="button" size="sm" variant="outline" onClick={autoDistribute}>
                <Wand2 className="h-4 w-4 ml-1" />
                توزیع خودکار (از قدیمی‌ترین)
              </Button>
            </div>

            <ScrollArea className="max-h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کد سفارش</TableHead>
                    <TableHead>نوع خدمت</TableHead>
                    <TableHead>مبلغ کل</TableHead>
                    <TableHead>پرداخت‌شده</TableHead>
                    <TableHead>مانده</TableHead>
                    <TableHead>سهم این پرداخت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.code}</TableCell>
                      <TableCell className="text-sm">{o.service_type_name || '-'}</TableCell>
                      <TableCell className="text-sm">{fmt(o.payment_amount)}</TableCell>
                      <TableCell className="text-sm text-green-600">{fmt(o.total_paid)}</TableCell>
                      <TableCell className="text-sm text-orange-600 font-medium">
                        {fmt(o.remaining)}
                      </TableCell>
                      <TableCell>
                        <Input
                          inputMode="numeric"
                          className="w-32"
                          value={allocations[o.id] || ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d]/g, '');
                            setAllocations((prev) => ({
                              ...prev,
                              [o.id]: raw ? Number(raw).toLocaleString('en-US') : '',
                            }));
                          }}
                          placeholder="0"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted rounded-lg text-sm">
              <div>مبلغ کل وارد شده: <b>{fmt(totalAmountNum)}</b></div>
              <div>مجموع توزیع‌شده: <b className="text-green-700">{fmt(totalAllocated)}</b></div>
              <div>
                باقی‌مانده توزیع:{' '}
                <b className={remainingToAllocate === 0 ? 'text-green-700' : 'text-orange-600'}>
                  {fmt(remainingToAllocate)}
                </b>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            انصراف
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || debtOrders.length === 0 || totalAmountNum <= 0}
          >
            {submitting ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Banknote className="h-4 w-4 ml-1" />}
            ثبت پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
