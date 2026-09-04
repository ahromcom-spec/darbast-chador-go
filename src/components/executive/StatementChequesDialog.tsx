import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCheck, CheckCircle2, XCircle, Loader2, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { recalculateBankCardBalance } from '@/hooks/useBankCardRealtimeSync';
import { formatPersianDate } from '@/lib/dateUtils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  statementId: string;
  statementNumber: number;
  customerName: string | null;
  onSuccess?: () => void;
}

interface Cheque {
  id: string;
  amount: number;
  serial_number: string;
  received_date: string;
  due_date: string;
  status: 'pending' | 'cleared' | 'bounced';
  cleared_at: string | null;
  bounced_at: string | null;
  bank_card_id: string | null;
  transaction_id: string | null;
  order_payment_ids: string[] | null;
  notes: string | null;
  image_url: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';
const fmtDate = (s?: string | null) => s ? formatPersianDate(s, { dateFormat: 'yyyy/MM/dd' }) : '—';

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: 'در انتظار وصول', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  cleared: { label: 'وصول شده', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  bounced: { label: 'برگشت خورده', cls: 'bg-red-100 text-red-800 border-red-300' },
};

export function StatementChequesDialog({ open, onOpenChange, statementId, statementNumber, customerName, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cheques')
        .select('*')
        .eq('statement_id', statementId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      const list = (data || []) as any as Cheque[];
      setCheques(list);
      // Generate signed URLs for any image_url paths
      const urls: Record<string, string> = {};
      await Promise.all(list.filter(c => c.image_url).map(async (c) => {
        try {
          const { data: signed } = await supabase.storage
            .from('cheque-images')
            .createSignedUrl(c.image_url as string, 60 * 60);
          if (signed?.signedUrl) urls[c.id] = signed.signedUrl;
        } catch {}
      }));
      setImageUrls(urls);
    } catch (e: any) {
      toast({ title: 'خطا', description: e?.message || 'دریافت چک‌ها با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open, statementId]);

  const handleClear = async (ch: Cheque) => {
    if (!user?.id) return;
    setBusyId(ch.id);
    try {
      const nowIso = new Date().toISOString();
      await supabase.from('cheques').update({
        status: 'cleared',
        cleared_at: nowIso,
      }).eq('id', ch.id);

      // Update bank card transaction description
      if (ch.transaction_id) {
        const { data: tx } = await supabase
          .from('bank_card_transactions')
          .select('description')
          .eq('id', ch.transaction_id)
          .single();
        if (tx?.description) {
          const newDesc = tx.description
            .replace('🟠 چک وصول نشده است', '🟢 چک وصول شده است')
            .replace('چک وصول نشده', 'چک وصول شده');
          await supabase
            .from('bank_card_transactions')
            .update({ description: newDesc, reference_type: 'cheque_cleared' })
            .eq('id', ch.transaction_id);
        }
      }

      // Confirm related order payments (mark fully if applicable)
      if (ch.order_payment_ids && ch.order_payment_ids.length > 0) {
        // Fetch related orders to potentially set payment_confirmed_at
        const { data: pays } = await supabase
          .from('order_payments')
          .select('order_id')
          .in('id', ch.order_payment_ids);
        const orderIds = Array.from(new Set((pays || []).map((p: any) => p.order_id)));
        for (const oid of orderIds) {
          const { data: ord } = await supabase
            .from('projects_v3')
            .select('total_price, total_paid, status, execution_stage, payment_confirmed_at')
            .eq('id', oid)
            .maybeSingle();
          if (ord && Number(ord.total_paid) >= Number(ord.total_price || 0) && !ord.payment_confirmed_at) {
            const upd: any = { payment_confirmed_at: nowIso, payment_confirmed_by: user.id };
            if (ord.status !== 'closed') upd.status = 'paid';
            // مرحله اجرایی خودکار جلو نمی‌رود
            await supabase.from('projects_v3').update(upd).eq('id', oid);
          }
        }
      }

      if (ch.bank_card_id) {
        await recalculateBankCardBalance(ch.bank_card_id);
        window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
      }

      toast({ title: '✓ چک وصول شد', description: `سریال ${ch.serial_number}` });
      await load();
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'خطا', description: e?.message || 'تایید وصول با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleBounce = async (ch: Cheque) => {
    if (!user?.id) return;
    if (!confirm(`آیا مطمئنید چک سریال ${ch.serial_number} برگشت خورده است؟ مبلغ از سفارش‌ها و تراکنش کارت بانکی حذف می‌شود.`)) return;
    setBusyId(ch.id);
    try {
      const nowIso = new Date().toISOString();

      // Delete related order_payments → restore order remaining
      if (ch.order_payment_ids && ch.order_payment_ids.length > 0) {
        const { data: pays } = await supabase
          .from('order_payments')
          .select('id, order_id, amount')
          .in('id', ch.order_payment_ids);

        // Group by order, recompute totals
        const byOrder = new Map<string, number>();
        for (const p of (pays || [])) {
          byOrder.set(p.order_id, (byOrder.get(p.order_id) || 0) + Number(p.amount));
        }
        await supabase.from('order_payments').delete().in('id', ch.order_payment_ids);

        for (const [oid, amt] of byOrder) {
          const { data: ord } = await supabase
            .from('projects_v3')
            .select('total_paid')
            .eq('id', oid)
            .maybeSingle();
          if (ord) {
            const newPaid = Math.max(0, Number(ord.total_paid || 0) - amt);
            await supabase.from('projects_v3').update({
              total_paid: newPaid,
              payment_confirmed_at: null,
              payment_confirmed_by: null,
              updated_at: nowIso,
            }).eq('id', oid);
          }
        }
      }

      // Delete the bank card transaction → balance reverses via SSoT
      if (ch.transaction_id) {
        await supabase.from('bank_card_transactions').delete().eq('id', ch.transaction_id);
      }

      // Mark cheque as bounced
      await supabase.from('cheques').update({
        status: 'bounced',
        bounced_at: nowIso,
        transaction_id: null,
      }).eq('id', ch.id);

      if (ch.bank_card_id) {
        await recalculateBankCardBalance(ch.bank_card_id);
        window.dispatchEvent(new CustomEvent('bank-card-balance-updated'));
      }

      toast({ title: 'چک برگشت خورد', description: `سریال ${ch.serial_number} — مبالغ بازگردانده شد`, variant: 'destructive' });
      await load();
      onSuccess?.();
    } catch (e: any) {
      toast({ title: 'خطا', description: e?.message || 'ثبت برگشت چک با خطا مواجه شد', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-amber-600" />
            مدیریت چک‌های صورتحساب
          </DialogTitle>
          <DialogDescription>
            صورتحساب شماره {new Intl.NumberFormat('fa-IR').format(statementNumber)} — {customerName || ''}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin ml-2" /> در حال بارگذاری...
            </div>
          ) : cheques.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">هیچ چکی برای این صورتحساب ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {cheques.map(ch => {
                const meta = statusMeta[ch.status] || statusMeta.pending;
                return (
                  <div key={ch.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">سریال: {ch.serial_number}</span>
                        </div>
                        <div className="font-bold text-base">{fmt(ch.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          تحویل: {fmtDate(ch.received_date)} — سررسید: <span className="font-semibold text-foreground">{fmtDate(ch.due_date)}</span>
                        </div>
                        {ch.notes && <div className="text-xs text-muted-foreground">یادداشت: {ch.notes}</div>}
                        {ch.cleared_at && <div className="text-xs text-emerald-700">وصول شده در: {fmtDate(ch.cleared_at)}</div>}
                        {ch.bounced_at && <div className="text-xs text-red-700">برگشت در: {fmtDate(ch.bounced_at)}</div>}
                      </div>
                      {ch.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleClear(ch)}
                            disabled={busyId === ch.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            تایید وصول
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleBounce(ch)}
                            disabled={busyId === ch.id}
                            className="gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            برگشت چک
                          </Button>
                        </div>
                      )}
                    </div>
                    {ch.image_url && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <ImageIcon className="h-3.5 w-3.5" />
                          تصویر چک
                        </div>
                        {imageUrls[ch.id] ? (
                          <a
                            href={imageUrls[ch.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block relative group"
                          >
                            <img
                              src={imageUrls[ch.id]}
                              alt={`تصویر چک ${ch.serial_number}`}
                              className="max-h-48 rounded-md border border-border object-contain bg-muted cursor-zoom-in"
                              loading="lazy"
                            />
                            <span className="absolute top-1 left-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </span>
                          </a>
                        ) : (
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            در حال بارگذاری تصویر...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>بستن</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
