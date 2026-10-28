import { useEffect, useState } from 'react';
import { Split, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatPersianDate } from '@/lib/dateUtils';
import { BillingCharge, fetchBillingCharges, transferPreview } from '@/lib/orderChargeBilling';

const fmt = (n: number) => `${new Intl.NumberFormat('fa-IR').format(n)} تومان`;
type Order = { id: string; code: string; total_price: number | null; total_paid: number | null; statement_id: string | null };

export function SeparateOrderChargesDialog({ orderId, orderCode, onSuccess }: { orderId: string; orderCode: string; onSuccess?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [charges, setCharges] = useState<BillingCharge[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [source, setSource] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [target, setTarget] = useState('new');
  const [discount, setDiscount] = useState(0);
  const [requestId, setRequestId] = useState('');
  const { toast } = useToast();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); setSelected([]); setTarget('new'); setRequestId(crypto.randomUUID());
    (async () => {
      const [items, result] = await Promise.all([fetchBillingCharges(orderId), supabase.from('projects_v3').select('id,code,customer_id,total_price,total_paid,statement_id').eq('id', orderId).single()]);
      if (result.error) throw result.error;
      const [destinations, statement] = await Promise.all([
        supabase.from('projects_v3').select('id,code,total_price,total_paid,statement_id').eq('customer_id', result.data.customer_id).neq('id', orderId).not('status', 'in', '(draft,rejected)').eq('is_deep_archived', false).order('code', { ascending: false }),
        result.data.statement_id ? supabase.from('customer_statements').select('discount_amount').eq('id', result.data.statement_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (destinations.error) throw destinations.error;
      if (cancelled) return;
      setCharges(items); setSource(result.data); setOrders(destinations.data || []); setDiscount(Number(statement.data?.discount_amount || 0));
    })().catch(error => { if (!cancelled) toast({ title: 'بارگذاری ناموفق', description: error.message, variant: 'destructive' }); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, orderId, toast]);
  const picked = charges.filter(c => selected.includes(`${c.kind}:${c.id}`));
  const sum = picked.reduce((n, c) => n + c.amount, 0);
  const dest = orders.find(o => o.id === target);
  const preview = transferPreview(Number(source?.total_price || 0), Number(source?.total_paid || 0), sum, Number(dest?.total_price || 0), Number(dest?.total_paid || 0));
  const submit = async () => {
    if (!picked.length || !source) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('transfer_order_charges', { _source_order_id: orderId, _renewal_ids: picked.filter(c => c.kind === 'renewal').map(c => c.id), _repair_ids: picked.filter(c => c.kind === 'repair').map(c => c.id), _request_id: requestId, _target_order_id: target === 'new' ? null : target });
      if (error) throw error;
      const result = data as { code?: string };
      toast({ title: 'جداسازی انجام شد', description: `مبلغ ${fmt(sum)} به سفارش ${result.code || dest?.code || ''} منتقل شد.` });
      await onSuccess?.(); setOpen(false);
    } catch (error) { toast({ title: 'جداسازی انجام نشد', description: error instanceof Error ? error.message : 'خطا در انتقال', variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2"><Split className="h-4 w-4" />جداسازی تمدید و تعمیرات</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>جداسازی هزینه‌های سفارش {orderCode}</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : <>
          <div className="divide-y border rounded-md">
            {charges.length === 0 && <p className="p-4 text-muted-foreground">تمدید یا تعمیر دارای مبلغ تأییدشده وجود ندارد.</p>}
            {charges.map(c => { const key = `${c.kind}:${c.id}`; return <Label key={key} className="flex items-start gap-3 p-3 cursor-pointer">
              <Checkbox checked={selected.includes(key)} disabled={saving} onCheckedChange={checked => setSelected(prev => checked ? [...prev, key] : prev.filter(k => k !== key))} />
              <span className="flex-1 min-w-0"><span className="block break-words">{c.title}</span><span className="block text-xs text-muted-foreground mt-1">{c.start ? formatPersianDate(c.start) : '—'}{c.end ? ` تا ${formatPersianDate(c.end)}` : ''}</span></span>
              <span className="whitespace-nowrap text-sm">{fmt(c.amount)}</span>
            </Label>; })}
          </div>
          <div className="space-y-2"><Label>سفارش مقصد</Label><Select value={target} onValueChange={setTarget} disabled={saving}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">سفارش جدید با صورتحساب مستقل</SelectItem>{orders.map(o => <SelectItem key={o.id} value={o.id}>سفارش {o.code} — {fmt(Number(o.total_price || 0))}</SelectItem>)}</SelectContent></Select></div>
          <dl className="space-y-2 text-sm border-t pt-3">
            <div className="flex justify-between gap-3"><dt>مبلغ انتخابی</dt><dd className="font-bold">{fmt(sum)}</dd></div>
            <div className="flex justify-between gap-3"><dt>مبلغ سفارش مبدأ پس از انتقال</dt><dd>{fmt(preview.sourceTotal)}</dd></div>
            <div className="flex justify-between gap-3"><dt>پرداخت قبلی مبدأ (بدون تغییر)</dt><dd>{fmt(Number(source?.total_paid || 0))}</dd></div>
            <div className="flex justify-between gap-3"><dt>مانده سفارش مقصد پس از انتقال</dt><dd>{fmt(preview.targetRemaining)}</dd></div>
            {discount > 0 && <div className="flex justify-between gap-3"><dt>تخفیف صورتحساب قبلی (بدون تغییر)</dt><dd>{fmt(discount)}</dd></div>}
          </dl>
          {preview.sourceOverpaid > 0 && <p role="alert" className="border border-destructive rounded-md p-3 text-sm text-destructive">پس از انتقال، {fmt(preview.sourceOverpaid)} اضافه‌پرداخت روی سفارش قبلی باقی می‌ماند. این پرداخت به مقصد منتقل نمی‌شود.</p>}
        </>}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>انصراف</Button><Button onClick={submit} disabled={loading || saving || !picked.length}>{saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}تأیید جداسازی</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}