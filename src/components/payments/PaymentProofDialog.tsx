import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { Receipt, FileImage, Upload, Loader2, Trash2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { uploadPaymentImage, type PaymentSubmissionKind } from '@/lib/paymentSubmissions';
import { toEnglishDigits } from '@/lib/numberParsing';
import { ImageZoomModal } from '@/components/common/ImageZoomModal';


interface Props {
  orderId?: string | null;
  statementId?: string | null;
  customerId?: string | null;
  defaultAmount?: number;
  buttonLabel?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  onSubmitted?: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n || 0));

export default function PaymentProofDialog({
  orderId, statementId, customerId, defaultAmount = 0,
  buttonLabel = 'ارسال فیش واریزی / چک', className, variant = 'outline', onSubmitted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PaymentSubmissionKind>('receipt');
  const [amount, setAmount] = useState<string>(defaultAmount ? String(Math.round(defaultAmount)) : '');
  const [notes, setNotes] = useState('');
  const [serial, setSerial] = useState('');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const numericAmount = Number(toEnglishDigits(amount).replace(/[^\d]/g, '')) || 0;

  const reset = () => {
    setKind('receipt'); setAmount(defaultAmount ? String(Math.round(defaultAmount)) : '');
    setNotes(''); setSerial(''); setFile(null); setDueDate(new Date().toISOString());
  };

  const submit = async () => {
    if (numericAmount <= 0) { toast.error('مبلغ واریزی را وارد کنید'); return; }
    if (!file && !notes.trim()) { toast.error('عکس فیش را انتخاب کنید یا توضیحات پرداخت را بنویسید'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ابتدا وارد حساب شوید');
      const imagePath = file ? await uploadPaymentImage(file, user.id) : null;
      const { error } = await supabase.from('payment_submissions').insert({
        order_id: orderId || null,
        statement_id: statementId || null,
        customer_id: customerId || user.id,
        submitted_by: user.id,
        kind,
        amount: numericAmount,
        notes: notes || null,
        image_path: imagePath,
        cheque_serial: kind === 'cheque' ? (serial || null) : null,
        cheque_due_date: kind === 'cheque' ? dueDate : null,
      } as any);
      if (error) throw error;
      toast.success('فیش شما ارسال شد و پس از تایید مدیریت ثبت می‌شود');
      setOpen(false); reset(); onSubmitted?.();
    } catch (e: any) {
      toast.error(e?.message || 'خطا در ارسال فیش');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <Receipt className="h-4 w-4 ml-1" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>ارسال فیش واریزی یا عکس چک</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={kind === 'receipt' ? 'default' : 'outline'} onClick={() => setKind('receipt')}>
                فیش واریزی
              </Button>
              <Button type="button" variant={kind === 'cheque' ? 'default' : 'outline'} onClick={() => setKind('cheque')}>
                چک
              </Button>
            </div>

            <div className="space-y-1">
              <Label>مبلغ (تومان)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" dir="ltr" className="text-center" />
              {numericAmount > 0 && <p className="text-xs text-muted-foreground">{fmt(numericAmount)} تومان</p>}
            </div>

            {kind === 'cheque' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>شماره سریال چک</Label>
                  <Input value={serial} onChange={(e) => setSerial(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>تاریخ سررسید</Label>
                  <PersianDatePicker value={dueDate} onChange={(v) => setDueDate(v || new Date().toISOString())} />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>عکس {kind === 'cheque' ? 'چک' : 'فیش واریزی'} (اختیاری)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <FileImage className="h-3 w-3" /> {file.name}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>توضیحات {file ? '' : '(در صورت نداشتن عکس، الزامی)'}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="مثلا: کارت به کارت به حساب شرکت در تاریخ ..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              ارسال برای تایید مدیریت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
