import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRightLeft, Lock, Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StatementOption {
  id: string;
  statement_number: number;
  status: 'open' | 'closed';
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
  orderCode: string;
  currentStatementId: string;
  customerId: string;
  customerName: string | null;
  statements: StatementOption[];
  onSuccess: () => void | Promise<void>;
}

const NEW_VALUE = '__NEW__';

export function TransferOrderStatementDialog({
  open, onOpenChange, orderId, orderCode, currentStatementId, customerId, customerName, statements, onSuccess,
}: Props) {
  const { toast } = useToast();
  const [targetId, setTargetId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () => statements.filter(s => s.id !== currentStatementId),
    [statements, currentStatementId],
  );

  const nextNumber = useMemo(
    () => (statements.reduce((m, s) => Math.max(m, s.statement_number), 0) || 0) + 1,
    [statements],
  );

  const handleSubmit = async () => {
    if (!targetId) {
      toast({ title: 'صورتحساب مقصد را انتخاب کنید', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      let destId = targetId;

      if (targetId === NEW_VALUE) {
        const { data: created, error: cErr } = await supabase
          .from('customer_statements' as any)
          .insert({
            customer_id: customerId,
            statement_number: nextNumber,
            status: 'open',
          })
          .select('id')
          .single();
        if (cErr) throw cErr;
        destId = (created as any).id;
      }

      const { error } = await supabase.rpc('transfer_order_to_statement' as any, {
        _order_id: orderId,
        _target_statement_id: destId,
      });
      if (error) throw error;
      toast({ title: 'انجام شد', description: `سفارش ${orderCode} منتقل شد` });
      await onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'خطا', description: err.message || 'انتقال سفارش با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            انتقال سفارش به صورتحساب دیگر
          </DialogTitle>
          <DialogDescription>
            سفارش <b>{orderCode}</b>{customerName ? ` از مشتری «${customerName}»` : ''} را به یکی از صورتحساب‌های زیر منتقل کنید،
            یا یک صورتحساب جدید بسازید. مبالغ هر دو صورتحساب به‌صورت خودکار بازمحاسبه می‌شود.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={targetId} onValueChange={setTargetId} className="space-y-2 max-h-[50vh] overflow-y-auto">
          {options.map(s => (
            <Label
              key={s.id}
              htmlFor={`stmt-${s.id}`}
              className="flex items-center justify-between gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem id={`stmt-${s.id}`} value={s.id} />
                <span className="font-semibold">
                  صورتحساب شماره {new Intl.NumberFormat('fa-IR').format(s.statement_number)}
                </span>
              </div>
              {s.status === 'open' ? (
                <Badge className="bg-blue-500/20 text-blue-700 border border-blue-500/40">باز</Badge>
              ) : (
                <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />بسته</Badge>
              )}
            </Label>
          ))}

          <Label
            htmlFor="stmt-new"
            className="flex items-center justify-between gap-3 p-3 border border-dashed border-primary/50 rounded-md cursor-pointer hover:bg-primary/5 bg-primary/[0.03]"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem id="stmt-new" value={NEW_VALUE} />
              <span className="font-semibold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                ساخت صورتحساب جدید شماره {new Intl.NumberFormat('fa-IR').format(nextNumber)}
              </span>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-700 border border-emerald-500/40 gap-1">
              <Sparkles className="h-3 w-3" />جدید
            </Badge>
          </Label>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>انصراف</Button>
          <Button onClick={handleSubmit} disabled={busy || !targetId}>
            {busy && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            انتقال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
