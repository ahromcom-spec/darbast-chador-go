import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BadgePercent, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseLocalizedNumber } from '@/lib/numberParsing';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** حالت: تخفیف یک صورتحساب یا تخفیف کلی مشتری */
  scope: 'statement' | 'global';
  statementId?: string;
  statementNumber?: number;
  customerId: string;
  customerName: string | null;
  currentAmount: number;
  currentNote: string | null;
  /** مانده فعلی برای پیشنهاد صفر کردن خورده حساب */
  remaining: number;
  onSuccess?: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0));

export function StatementDiscountDialog({
  open, onOpenChange, scope, statementId, statementNumber, customerId, customerName,
  currentAmount, currentNote, remaining, onSuccess,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(currentAmount ? String(Math.round(currentAmount)) : '');
      setNote(currentNote || '');
    }
  }, [open, currentAmount, currentNote]);

  const parsed = Math.max(0, Math.round(parseLocalizedNumber(amount) || 0));

  const save = async () => {
    setBusy(true);
    try {
      if (scope === 'statement') {
        if (!statementId) throw new Error('صورتحساب مشخص نیست');
        const { error } = await supabase
          .from('customer_statements' as any)
          .update({ discount_amount: parsed, discount_note: note.trim() || null } as any)
          .eq('id', statementId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customer_global_discounts' as any)
          .upsert({
            customer_id: customerId,
            discount_amount: parsed,
            discount_note: note.trim() || null,
            created_by: user?.id || null,
          } as any, { onConflict: 'customer_id' });
        if (error) throw error;
      }
      toast({ title: '✓ تخفیف ذخیره شد', description: `${fmt(parsed)} تومان` });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'خطا', description: e?.message || 'ذخیره تخفیف با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-emerald-600" />
            {scope === 'statement'
              ? `تخفیف صورتحساب شماره ${fmt(statementNumber || 0)}`
              : 'تخفیف کلی مشتری'}
          </DialogTitle>
          <DialogDescription>
            {customerName || ''} — مانده فعلی: <b>{fmt(remaining)} تومان</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>مبلغ تخفیف (تومان)</Label>
            <Input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="مثلاً ۵۰۰۰۰"
              inputMode="numeric"
            />
            {parsed > 0 && <p className="text-xs text-muted-foreground">{fmt(parsed)} تومان</p>}
          </div>

          {remaining > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setAmount(String(Math.round(remaining)))}
            >
              صفر کردن مانده با تخفیف ({fmt(remaining)} تومان)
            </Button>
          )}

          <div className="space-y-1">
            <Label>توضیح تخفیف (اختیاری)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="مثلاً تخفیف خورده حساب" />
          </div>

          <p className="text-xs text-muted-foreground">
            مبلغ تخفیف در انتهای صورتحساب و فاکتور نمایش داده می‌شود و از مانده قابل پرداخت کسر می‌گردد.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>انصراف</Button>
          <Button onClick={save} disabled={busy} className="gap-1">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            ذخیره تخفیف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StatementDiscountDialog;
