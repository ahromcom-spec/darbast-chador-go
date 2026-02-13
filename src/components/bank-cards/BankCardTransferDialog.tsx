import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeftRight, CreditCard, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BankCardTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: BankCard[];
  onTransferComplete: () => void;
  /** Pre-select source card */
  defaultFromCardId?: string;
}

export function BankCardTransferDialog({
  open,
  onOpenChange,
  cards,
  onTransferComplete,
  defaultFromCardId,
}: BankCardTransferDialogProps) {
  const { user } = useAuth();
  const [fromCardId, setFromCardId] = useState(defaultFromCardId || '');
  const [toCardId, setToCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState<string | undefined>(new Date().toISOString());
  const [saving, setSaving] = useState(false);

  const activeCards = cards.filter((c) => c.is_active);
  const fromCard = activeCards.find((c) => c.id === fromCardId);
  const toCard = activeCards.find((c) => c.id === toCardId);

  const parsedAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10) || 0;

  const handleAmountChange = (value: string) => {
    const digits = value.replace(/[^0-9۰-۹٠-٩]/g, '');
    // Convert Persian/Arabic digits
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const normalized = digits
      .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
    setAmount(normalized);
  };

  const handleSubmit = async () => {
    if (!user || !fromCardId || !toCardId || parsedAmount <= 0) return;

    if (fromCardId === toCardId) {
      toast.error('کارت مبدا و مقصد نمی‌تواند یکسان باشد');
      return;
    }

    if (!fromCard || !toCard) return;

    setSaving(true);
    try {
      const transferDesc = description.trim() 
        || `انتقال از ${fromCard.card_name} به ${toCard.card_name}`;

      const fromNewBalance = fromCard.current_balance - parsedAmount;
      const toNewBalance = toCard.current_balance + parsedAmount;

      // Build created_at from transactionDate or now
      const createdAt = transactionDate
        ? new Date(transactionDate).toISOString()
        : new Date().toISOString();

      // Insert both transactions
      const { error: txError } = await supabase
        .from('bank_card_transactions')
        .insert([
          {
            bank_card_id: fromCardId,
            transaction_type: 'withdrawal',
            amount: parsedAmount,
            balance_after: fromNewBalance,
            description: `انتقال به ${toCard.card_name}` + (description ? ` - ${description}` : ''),
            reference_type: 'card_transfer',
            reference_id: toCardId,
            created_by: user.id,
            created_at: createdAt,
          },
          {
            bank_card_id: toCardId,
            transaction_type: 'deposit',
            amount: parsedAmount,
            balance_after: toNewBalance,
            description: `انتقال از ${fromCard.card_name}` + (description ? ` - ${description}` : ''),
            reference_type: 'card_transfer',
            reference_id: fromCardId,
            created_by: user.id,
            created_at: createdAt,
          },
        ]);

      if (txError) throw txError;

      toast.success(`مبلغ ${parsedAmount.toLocaleString('fa-IR')} تومان با موفقیت منتقل شد`);
      
      // Reset form
      setFromCardId('');
      setToCardId('');
      setAmount('');
      setDescription('');
      setTransactionDate(new Date().toISOString());
      onOpenChange(false);
      onTransferComplete();
    } catch (error) {
      console.error('Error transferring:', error);
      toast.error('خطا در انتقال وجه');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setFromCardId(defaultFromCardId || '');
      setToCardId('');
      setAmount('');
      setDescription('');
      setTransactionDate(new Date().toISOString());
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
            انتقال وجه بین کارت‌ها
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* From Card */}
          <div className="space-y-2">
            <Label>از کارت (مبدا)</Label>
            <Select value={fromCardId} onValueChange={setFromCardId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب کارت مبدا" />
              </SelectTrigger>
              <SelectContent>
                {activeCards
                  .filter((c) => c.id !== toCardId)
                  .map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{card.card_name}</span>
                        <span className="text-xs text-muted-foreground mr-1">
                          ({card.current_balance.toLocaleString('fa-IR')} ت)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Card */}
          <div className="space-y-2">
            <Label>به کارت (مقصد)</Label>
            <Select value={toCardId} onValueChange={setToCardId}>
              <SelectTrigger>
                <SelectValue placeholder="انتخاب کارت مقصد" />
              </SelectTrigger>
              <SelectContent>
                {activeCards
                  .filter((c) => c.id !== fromCardId)
                  .map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{card.card_name}</span>
                        <span className="text-xs text-muted-foreground mr-1">
                          ({card.current_balance.toLocaleString('fa-IR')} ت)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>مبلغ (تومان)</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="مبلغ انتقال را وارد کنید"
              value={parsedAmount > 0 ? parsedAmount.toLocaleString('fa-IR') : ''}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="text-lg font-semibold"
              dir="ltr"
            />
          </div>

          {/* Transaction Date */}
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

          {/* Description */}
          <div className="space-y-2">
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              placeholder="توضیحات انتقال..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Summary */}
          {fromCard && toCard && parsedAmount > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">از:</span>
                <span className="font-medium">{fromCard.card_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">به:</span>
                <span className="font-medium">{toCard.card_name}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground">مبلغ:</span>
                <span className="font-bold text-emerald-600">
                  {parsedAmount.toLocaleString('fa-IR')} تومان
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={saving || !fromCardId || !toCardId || parsedAmount <= 0 || fromCardId === toCardId}
            className="w-full gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال انتقال...
              </>
            ) : (
              <>
                <ArrowLeftRight className="h-4 w-4" />
                انتقال وجه
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
