import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle, Eye, Loader2, ClipboardCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBankCards } from '@/hooks/useBankCards';
import { toEnglishDigits } from '@/lib/numberParsing';
import {
  approvePaymentSubmission, deletePaymentSubmission, kindLabels, rejectPaymentSubmission,
  signPaymentImages, submissionStatusLabels, type PaymentSubmission,
} from '@/lib/paymentSubmissions';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';

interface Props {
  orderId?: string | null;
  statementId?: string | null;
  customerName?: string | null;
  buttonLabel?: string;
  onChanged?: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';

export default function PaymentSubmissionsReviewDialog({
  orderId, statementId, customerName, buttonLabel = 'بررسی فیش‌های مشتری', onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [cardBySub, setCardBySub] = useState<Record<string, string>>({});
  const [noteBySub, setNoteBySub] = useState<Record<string, string>>({});
  const [amountBySub, setAmountBySub] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const { cards } = useBankCards();

  const load = useCallback(async () => {
    if (!orderId && !statementId) return;
    let q = supabase.from('payment_submissions').select('*').order('created_at', { ascending: false });
    q = orderId ? q.eq('order_id', orderId) : q.eq('statement_id', statementId!);
    const { data } = await q;
    const list = (data || []) as unknown as PaymentSubmission[];
    setRows(list);
    setPendingCount(list.filter(r => r.status === 'pending').length);
    setAmountBySub(Object.fromEntries(list.map(r => [r.id, String(Math.round(Number(r.amount) || 0))])));
    setImages(await signPaymentImages(list.map(r => r.image_path)));
  }, [orderId, statementId]);

  useEffect(() => { load(); }, [load]);

  const approve = async (sub: PaymentSubmission) => {
    const cardId = cardBySub[sub.id] || null;
    if (!cardId) { toast.error('کارت بانکی مقصد را انتخاب کنید'); return; }
    const amount = Number(toEnglishDigits(amountBySub[sub.id] ?? '').replace(/[^\d]/g, '')) || 0;
    if (amount <= 0) { toast.error('مبلغ تراکنش را وارد کنید'); return; }
    setBusy(sub.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('احراز هویت نشده');
      await approvePaymentSubmission({
        submission: sub, bankCardId: cardId, reviewerId: user.id,
        reviewNotes: noteBySub[sub.id], customerName, amountOverride: amount,
      });
      toast.success('فیش تایید و پرداخت برای سفارش ثبت شد');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'خطا در تایید فیش');
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
      toast.success('فیش رد شد');
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'خطا در رد فیش');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (sub: PaymentSubmission) => {
    const msg = sub.status === 'approved'
      ? 'این تراکنش تاییدشده حذف شود؟ مبلغ از سفارش و تراکنش کارت بانکی نیز برگردانده می‌شود.'
      : 'این تراکنش اعلام‌شده حذف شود؟';
    if (!window.confirm(msg)) return;
    setBusy(sub.id);
    try {
      await deletePaymentSubmission(sub, { allowApproved: true });
      toast.success('تراکنش حذف شد');

      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'خطا در حذف تراکنش');
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setOpen(true)}>
        <ClipboardCheck className="h-3.5 w-3.5" />
        {buttonLabel}
        {pendingCount > 0 && <Badge className="bg-amber-500 text-white h-4 px-1">{pendingCount}</Badge>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>فیش‌ها و چک‌های ارسالی مشتری</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {rows.map((r) => {
              const st = submissionStatusLabels[r.status];
              return (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
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
                      <img src={images[r.image_path]} alt="تصویر فیش" className="max-h-48 rounded-md border object-contain" />
                    </a>
                  )}

                  {r.status === 'pending' ? (
                    <div className="grid gap-2 md:grid-cols-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">مبلغ تاییدشده (تومان)</Label>
                        <Input className="h-9 text-center" dir="ltr" inputMode="numeric"
                          value={amountBySub[r.id] ?? ''}
                          onChange={(e) => setAmountBySub(p => ({ ...p, [r.id]: e.target.value }))} />
                        <p className="text-[11px] text-muted-foreground">اعلام مشتری: {fmt(r.amount)}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">کارت بانکی مقصد</Label>
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
                      <div className="flex gap-2 md:col-span-3 flex-wrap">
                        <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={busy === r.id} onClick={() => approve(r)}>
                          {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          تایید و ثبت
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1" disabled={busy === r.id} onClick={() => reject(r)}>
                          <XCircle className="h-4 w-4" /> رد
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive"
                          disabled={busy === r.id} onClick={() => remove(r)}>
                          <Trash2 className="h-4 w-4" /> حذف
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {r.review_notes && <p className="text-xs text-muted-foreground">یادداشت مدیریت: {r.review_notes}</p>}
                      <Button size="sm" variant="outline" className="gap-1 text-destructive h-7"
                        disabled={busy === r.id} onClick={() => remove(r)}>
                        <Trash2 className="h-3.5 w-3.5" /> حذف تراکنش
                      </Button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
