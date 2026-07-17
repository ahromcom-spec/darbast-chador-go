import { useState, useEffect } from 'react';
import { BankCard } from '@/hooks/useBankCards';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowDownCircle, ArrowUpCircle, Loader2, CalendarDays, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';

interface BankCardQuickTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: BankCard | null;
  type: 'deposit' | 'withdrawal';
  onComplete: () => void;
}

export function BankCardQuickTransactionDialog({
  open,
  onOpenChange,
  card,
  type,
  onComplete,
}: BankCardQuickTransactionDialogProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState<string | undefined>(new Date().toISOString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setDescription('');
      setTransactionDate(new Date().toISOString());
    }
  }, [open]);

  const parsedAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10) || 0;
  const isDeposit = type === 'deposit';

  const handleAmountChange = (value: string) => {
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const normalized = value
      .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
      .replace(/[^0-9]/g, '');
    setAmount(normalized);
  };

  const handleSubmit = async () => {
    if (!user || !card || parsedAmount <= 0) return;

    setSaving(true);
    try {
      const createdAt = transactionDate
        ? new Date(transactionDate).toISOString()
        : new Date().toISOString();
      const reportDate = createdAt.substring(0, 10);

      const newBalance = isDeposit
        ? Number(card.current_balance) + parsedAmount
        : Number(card.current_balance) - parsedAmount;

      const { data: insertedTransaction, error } = await supabase.from('bank_card_transactions').insert({
        bank_card_id: card.id,
        transaction_type: type,
        amount: parsedAmount,
        balance_after: newBalance,
        description: description.trim() || (isDeposit ? 'واریز دستی' : 'برداشت دستی'),
        reference_type: 'manual',
        created_by: user.id,
        created_at: createdAt,
        report_date: reportDate,
      } as any)
        .select('id')
        .single();

      if (error) throw error;
      if (!insertedTransaction?.id) throw new Error('تراکنش در لیست تراکنش‌ها ثبت نشد');

      // Recalculate to ensure balance is accurate (SSoT)
      await recalculateBankCardBalance(card.id);

      toast.success(
        `${isDeposit ? 'واریز' : 'برداشت'} مبلغ ${parsedAmount.toLocaleString('fa-IR')} تومان ثبت شد`
      );
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      toast.error(error?.message || 'خطا در ثبت تراکنش');
    } finally {
      setSaving(false);
    }
  };

  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDeposit ? (
              <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
            ) : (
              <ArrowUpCircle className="h-5 w-5 text-destructive" />
            )}
            {isDeposit ? 'واریز به کارت' : 'برداشت از کارت'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-muted/50 border flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <div className="flex-1">
              <div className="font-medium">{card.card_name}</div>
              <div className="text-xs text-muted-foreground">{card.bank_name}</div>
            </div>
            <div className="text-left">
              <div className="text-xs text-muted-foreground">موجودی فعلی</div>
              <div className="font-bold text-emerald-600">
                {card.current_balance.toLocaleString('fa-IR')} ت
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>مبلغ (تومان)</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="مبلغ را وارد کنید"
              value={parsedAmount > 0 ? parsedAmount.toLocaleString('fa-IR') : ''}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="text-lg font-semibold"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              تاریخ تراکنش
            </Label>
            <PersianDatePicker
              value={transactionDate}
              onChange={(val) => setTransactionDate(val)}
              placeholder="انتخاب تاریخ"
            />
          </div>

          <div className="space-y-2">
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              placeholder="توضیحات تراکنش..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {parsedAmount > 0 && (
            <div className="p-3 rounded-lg bg-muted/30 border text-sm flex justify-between">
              <span className="text-muted-foreground">موجودی پس از تراکنش:</span>
              <span className={`font-bold ${isDeposit ? 'text-emerald-600' : 'text-destructive'}`}>
                {(isDeposit
                  ? card.current_balance + parsedAmount
                  : card.current_balance - parsedAmount
                ).toLocaleString('fa-IR')}{' '}
                تومان
              </span>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={saving || parsedAmount <= 0}
            variant={isDeposit ? 'default' : 'destructive'}
            className="w-full gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ثبت...
              </>
            ) : (
              <>
                {isDeposit ? (
                  <ArrowDownCircle className="h-4 w-4" />
                ) : (
                  <ArrowUpCircle className="h-4 w-4" />
                )}
                ثبت {isDeposit ? 'واریز' : 'برداشت'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
