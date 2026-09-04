import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Eye, Loader2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useBankCards } from '@/hooks/useBankCards';
import {
  approvePaymentSubmission, kindLabels, rejectPaymentSubmission, signPaymentImages,
  submissionStatusLabels, type PaymentSubmission,
} from '@/lib/paymentSubmissions';

interface Props {
  orderId?: string | null;
  statementId?: string | null;
  customerName?: string | null;
  onChanged?: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';

/**
 * فیش‌ها و چک‌های ارسالی مشتری، به‌صورت درون‌خطی در پنجره تراکنش‌های سفارش
 * تا مدیر بتواند همان‌جا کارت مقصد را انتخاب و تراکنش را تایید یا رد کند.
 */
export default function OrderPaymentSubmissionsPanel({ orderId, statementId, customerName, onChanged }: Props) {
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [cardBySub, setCardBySub] = useState<Record<string, string>>({});
  const [noteBySub, setNoteBySub] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { cards } = useBankCards();

  const load = useCallback(async () => {
    if (!orderId && !statementId) return;
    let q = supabase.from('payment_submissions').select('*').order('created_at', { ascending: false });
    q = orderId ? q.eq('order_id', orderId) : q.eq('statement_id', statementId!);
    const { data } = await q;
    const list = (data || []) as unknown as PaymentSubmission[];
    setRows(list);
    setImages(await signPaymentImages(list.map(r => r.image_path)));
  }, [orderId, statementId]);

  useEffect(() => { load(); }, [load]);

  const approve = async (sub: PaymentSubmission) => {
    const cardId = cardBySub[sub.id] || null;
    setBusy(sub.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('احراز هویت نشده');
      await approvePaymentSubmission({
        submission: sub, bankCardId: cardId, reviewerId: user.id,
        reviewNotes: noteBySub[sub.id], customerName,
      });
      toast.success('تراکنش تایید و برای سفارش ثبت شد');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'خطا در تایید تراکنش');
    } finally {
      setBusy(null);
    }
  };

  const reject = async (sub: PaymentSubmission) => {
    setBusy(sub.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('احراز هویت نشده');
      await rejectPaymentSubmission(sub.id, user.id, noteBySub[sub.id]);
      toast.success('تراکنش رد شد');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'خطا در رد تراکنش');
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;

  const pending = rows.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-3" dir="rtl">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Inbox className="h-4 w-4" />
        تراکنش‌های اعلام‌شده توسط کارفرما ({rows.length})
        {pending > 0 && <Badge className="bg-amber-500 text-white">{pending} در انتظار بررسی</Badge>}
      </h4>

      {rows.map((r) => {
        const st = submissionStatusLabels[r.status];
        return (
          <div key={r.id} className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{kindLabels[r.kind]}</Badge>
                <span className="font-bold">{fmt(r.amount)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('fa-IR')}
                </span>
                {r.cheque_serial && <span className="text-xs">سریال: {r.cheque_serial}</span>}
                {r.cheque_due_date && (
                  <span className="text-xs">سررسید: {new Date(r.cheque_due_date).toLocaleDateString('fa-IR')}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={st.cls}>{st.label}</Badge>
                {r.image_path && images[r.image_path] && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1" asChild>
                    <a href={images[r.image_path]} target="_blank" rel="noreferrer">
                      <Eye className="h-3.5 w-3.5" /> مشاهده تصویر
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {r.notes && <p className="text-xs text-muted-foreground">توضیح مشتری: {r.notes}</p>}
            {r.image_path && images[r.image_path] && (
              <a href={images[r.image_path]} target="_blank" rel="noreferrer">
                <img src={images[r.image_path]} alt="تصویر فیش واریزی" className="max-h-44 rounded-md border object-contain" />
              </a>
            )}

            {r.status === 'pending' ? (
              <div className="grid gap-2 md:grid-cols-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">کارت بانکی مقصد (اختیاری)</Label>
                  <Select value={cardBySub[r.id] || ''} onValueChange={(v) => setCardBySub(p => ({ ...p, [r.id]: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="انتخاب کارت" /></SelectTrigger>
                    <SelectContent>
                      {cards.filter(c => c.is_active).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.card_name} — {c.bank_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">یادداشت بررسی</Label>
                  <Input className="h-9" value={noteBySub[r.id] || ''} onChange={(e) => setNoteBySub(p => ({ ...p, [r.id]: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busy === r.id} onClick={() => approve(r)}>
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    تایید و ثبت
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1" disabled={busy === r.id} onClick={() => reject(r)}>
                    <XCircle className="h-4 w-4" /> رد
                  </Button>
                </div>
              </div>
            ) : (
              r.review_notes && <p className="text-xs text-muted-foreground">یادداشت مدیریت: {r.review_notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
