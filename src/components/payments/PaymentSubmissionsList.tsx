import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, Pencil, Trash2, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { toEnglishDigits } from '@/lib/numberParsing';
import {
  deletePaymentSubmission, kindLabels, signPaymentImages, submissionStatusLabels,
  updatePaymentSubmission, uploadPaymentImage, type PaymentSubmission,
} from '@/lib/paymentSubmissions';

interface Props {
  orderId?: string | null;
  statementId?: string | null;
  refreshKey?: number;
  onChanged?: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0)) + ' تومان';

export default function PaymentSubmissionsList({ orderId, statementId, refreshKey = 0, onChanged }: Props) {
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId && !statementId) return;
    let q = supabase.from('payment_submissions').select('*').order('created_at', { ascending: false });
    q = orderId ? q.eq('order_id', orderId) : q.eq('statement_id', statementId!);
    const { data } = await q;
    const list = (data || []) as unknown as PaymentSubmission[];
    setRows(list);
    setImages(await signPaymentImages(list.map(r => r.image_path)));
  }, [orderId, statementId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const startEdit = (r: PaymentSubmission) => {
    setEditId(r.id);
    setEditAmount(String(Math.round(Number(r.amount) || 0)));
    setEditNotes(r.notes || '');
    setEditSerial(r.cheque_serial || '');
    setEditFile(null);
  };

  const saveEdit = async (r: PaymentSubmission) => {
    const amount = Number(toEnglishDigits(editAmount).replace(/[^\d]/g, '')) || 0;
    if (amount <= 0) { toast.error('مبلغ را درست وارد کنید'); return; }
    setBusy(r.id);
    try {
      let imagePath = r.image_path;
      if (editFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('ابتدا وارد حساب شوید');
        imagePath = await uploadPaymentImage(editFile, user.id);
      }
      await updatePaymentSubmission(r, {
        amount,
        notes: editNotes || null,
        cheque_serial: r.kind === 'cheque' ? (editSerial || null) : null,
        image_path: imagePath,
      });
      toast.success('تراکنش ویرایش شد');
      setEditId(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'خطا در ویرایش تراکنش');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: PaymentSubmission) => {
    if (!window.confirm('این تراکنش اعلام‌شده حذف شود؟')) return;
    setBusy(r.id);
    try {
      await deletePaymentSubmission(r);
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
    <div className="space-y-2 mt-3" dir="rtl">
      <p className="text-sm font-semibold">فیش‌های ارسالی شما</p>
      {rows.map((r) => {
        const st = submissionStatusLabels[r.status];
        const editable = r.status === 'pending';
        return (
          <div key={r.id} className="rounded-lg border p-2 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{kindLabels[r.kind]}</Badge>
                <span className="font-bold">{fmt(r.amount)}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString('fa-IR')}</span>
                {r.notes && <span className="text-muted-foreground">— {r.notes}</span>}
              </div>
              <div className="flex items-center gap-1">
                <Badge className={st.cls}>{st.label}</Badge>
                {r.image_path && images[r.image_path] && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1" asChild>
                    <a href={images[r.image_path]} target="_blank" rel="noreferrer">
                      <Eye className="h-3.5 w-3.5" /> تصویر
                    </a>
                  </Button>
                )}
                {editable && editId !== r.id && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => startEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" /> ویرایش
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-destructive"
                      disabled={busy === r.id} onClick={() => remove(r)}>
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      حذف
                    </Button>
                  </>
                )}
              </div>
            </div>

            {editable && editId === r.id && (
              <div className="grid gap-2 md:grid-cols-2 items-end pt-1 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">مبلغ (تومان)</Label>
                  <Input className="h-9 text-center" dir="ltr" inputMode="numeric"
                    value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">توضیحات</Label>
                  <Input className="h-9" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </div>
                {r.kind === 'cheque' && (
                  <div className="space-y-1">
                    <Label className="text-xs">شماره سریال چک</Label>
                    <Input className="h-9" dir="ltr" value={editSerial} onChange={(e) => setEditSerial(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">تصویر جدید (اختیاری)</Label>
                  <Input className="h-9" type="file" accept="image/*"
                    onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <Button size="sm" className="gap-1" disabled={busy === r.id} onClick={() => saveEdit(r)}>
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    ذخیره تغییرات
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditId(null)}>
                    <X className="h-4 w-4" /> انصراف
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
