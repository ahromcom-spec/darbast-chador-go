import { useEffect, useState } from 'react';
import { BankCardTransaction } from '@/hooks/useBankCards';
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
import { Loader2, CalendarDays, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { toast } from 'sonner';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankCardTransaction | null;
  onSaved: () => void;
}

export function BankCardTransactionEditDialog({ open, onOpenChange, transaction, onSaved }: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && transaction) {
      setAmount(String(transaction.amount));
      setDescription(transaction.description || '');
      const initial = transaction.effective_time || transaction.created_at;
      setTransactionDate(initial);
    }
  }, [open, transaction]);

  const handleAmountChange = (value: string) => {
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const normalized = value
      .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
      .replace(/[^0-9]/g, '');
    setAmount(normalized);
  };

  const parsedAmount = parseInt(amount || '0', 10) || 0;

  const handleSave = async () => {
    if (!transaction || parsedAmount <= 0) return;
    setSaving(true);
    try {
      const createdAt = transactionDate ? new Date(transactionDate).toISOString() : transaction.created_at;
      const reportDate = createdAt.substring(0, 10);

      const updatePayload: any = {
        amount: parsedAmount,
        description: description.trim() || null,
        created_at: createdAt,
        report_date: reportDate,
      };

      const { error } = await supabase
        .from('bank_card_transactions')
        .update(updatePayload)
        .eq('id', transaction.id);
      if (error) throw error;

      // If it's a card transfer, also update the paired transaction on the other card
      // Match exact pair using opposite type + same amount + same original created_at
      if (transaction.reference_type === 'card_transfer' && transaction.reference_id) {
        const oppositeType = transaction.transaction_type === 'deposit' ? 'withdrawal' : 'deposit';
        const { data: paired } = await supabase
          .from('bank_card_transactions')
          .select('id, bank_card_id')
          .eq('bank_card_id', transaction.reference_id)
          .eq('reference_type', 'card_transfer')
          .eq('reference_id', transaction.bank_card_id)
          .eq('transaction_type', oppositeType)
          .eq('amount', transaction.amount)
          .eq('created_at', transaction.created_at)
          .limit(1);

        if (paired && paired.length > 0) {
          await supabase
            .from('bank_card_transactions')
            .update(updatePayload)
            .eq('id', paired[0].id);
          await recalculateBankCardBalance(paired[0].bank_card_id);
        }
      }

      await recalculateBankCardBalance(transaction.bank_card_id);

      toast.success('تراکنش با موفقیت ویرایش شد');
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error('Error editing transaction:', err);
      toast.error(err?.message || 'خطا در ویرایش تراکنش');
    } finally {
      setSaving(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            ویرایش تراکنش
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>مبلغ (تومان)</Label>
            <Input
              type="text"
              inputMode="numeric"
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
            <Label>توضیحات</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Button onClick={handleSave} disabled={saving || parsedAmount <= 0} className="w-full gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ذخیره...
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                ذخیره تغییرات
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
