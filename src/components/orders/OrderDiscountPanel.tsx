import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BadgePercent, Loader2, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseLocalizedNumber } from '@/lib/numberParsing';

interface OrderDiscountPanelProps {
  orderId: string;
  /** مبلغ فعلی سفارش (پس از تخفیف) */
  currentPrice: number;
  /** مبلغ قبل از اعمال تخفیف (اگر تخفیفی ثبت شده باشد) */
  priceBeforeDiscount?: number | null;
  discountAmount?: number | null;
  discountNote?: string | null;
  onUpdate?: () => void;
}

export const OrderDiscountPanel = ({
  orderId,
  currentPrice,
  priceBeforeDiscount,
  discountAmount,
  discountNote,
  onUpdate,
}: OrderDiscountPanelProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const existingDiscount = Number(discountAmount || 0);
  const basePrice = Number(priceBeforeDiscount ?? currentPrice ?? 0);

  const [amount, setAmount] = useState(existingDiscount > 0 ? String(existingDiscount) : '');
  const [percent, setPercent] = useState('');
  const [note, setNote] = useState(discountNote || '');

  const discountValue = Math.max(0, Math.round(parseLocalizedNumber(amount)));
  const finalPrice = Math.max(0, basePrice - discountValue);
  const isChanged = discountValue !== existingDiscount || (note || '') !== (discountNote || '');

  const applyPercent = (value: string) => {
    setPercent(value);
    const p = parseLocalizedNumber(value);
    if (p > 0 && basePrice > 0) {
      setAmount(String(Math.round((basePrice * Math.min(p, 100)) / 100)));
    }
  };

  const save = async (remove = false) => {
    const d = remove ? 0 : discountValue;
    if (!remove && d > basePrice) {
      toast({ variant: 'destructive', title: 'خطا', description: 'مبلغ تخفیف بیشتر از مبلغ سفارش است' });
      return;
    }
    setSaving(true);
    try {
      const newPrice = Math.max(0, basePrice - d);
      const { error } = await supabase
        .from('projects_v3')
        .update({
          discount_amount: d,
          price_before_discount: d > 0 ? basePrice : null,
          discount_note: d > 0 ? (remove ? null : note || null) : null,
          payment_amount: newPrice,
          total_price: newPrice,
        } as any)
        .eq('id', orderId);
      if (error) throw error;

      if (remove) {
        setAmount('');
        setPercent('');
        setNote('');
      }
      toast({
        title: 'موفق',
        description: remove ? 'تخفیف حذف شد' : `تخفیف ${d.toLocaleString('fa-IR')} تومانی اعمال شد`,
      });
      onUpdate?.();
    } catch (err: any) {
      console.error('discount error', err);
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'خطا در ثبت تخفیف' });
    } finally {
      setSaving(false);
    }
  };

  if (basePrice <= 0) return null;

  return (
    <div className="p-4 rounded-lg border bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BadgePercent className="h-4 w-4 text-rose-600" />
          <Label className="text-sm font-bold">تخفیف مدیریتی سفارش</Label>
        </div>
        {existingDiscount > 0 && (
          <Badge className="bg-rose-600 text-white hover:bg-rose-600">
            تخفیف فعال: {existingDiscount.toLocaleString('fa-IR')} تومان
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">مبلغ تخفیف (تومان)</Label>
          <Input
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={discountValue > 0 ? discountValue.toLocaleString('fa-IR') : ''}
            onChange={(e) => {
              setPercent('');
              const digitsOnly = toEnglishDigits(e.target.value).replace(/[^\d]/g, '');
              setAmount(digitsOnly);
            }}
            placeholder="مبلغ تخفیف"
            className="font-bold"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">یا درصد تخفیف (%)</Label>
          <Input
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={percent}
            onChange={(e) => applyPercent(e.target.value)}
            placeholder="مثلاً ۱۰"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">علت تخفیف (نمایش به مشتری)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً تخفیف مشتری وفادار" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
        <div className="p-2 rounded bg-background border">
          <span className="text-muted-foreground text-xs block">مبلغ قبل از تخفیف</span>
          <span className="font-bold">{basePrice.toLocaleString('fa-IR')} تومان</span>
        </div>
        <div className="p-2 rounded bg-background border">
          <span className="text-muted-foreground text-xs block">تخفیف</span>
          <span className="font-bold text-rose-600">{discountValue.toLocaleString('fa-IR')} تومان</span>
        </div>
        <div className="p-2 rounded bg-background border">
          <span className="text-muted-foreground text-xs block">مبلغ نهایی سفارش</span>
          <span className="font-bold text-green-700 dark:text-green-300">{finalPrice.toLocaleString('fa-IR')} تومان</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => save(false)}
          disabled={saving || !isChanged}
          className="bg-rose-600 hover:bg-rose-700 text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
          {isChanged ? 'ثبت تخفیف' : 'ذخیره شده ✓'}
        </Button>
        {existingDiscount > 0 && (
          <Button variant="outline" onClick={() => save(true)} disabled={saving}>
            <Trash2 className="h-4 w-4 ml-1" />
            حذف تخفیف
          </Button>
        )}
      </div>
    </div>
  );
};
