import { useEffect, useState } from 'react';
import { Bot, Loader2, Sparkles, Check, User, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderReportRow, StaffReportRow, ROW_COLORS } from '@/hooks/useDailyReport';

interface StaffDirectoryItem {
  code: string;
  name: string;
  user_id?: string | null;
}

interface ReportBotDialogProps {
  orders: Order[];
  /** Persian label of the currently selected date (for display only) */
  dateLabel?: string;
  onApply: (rows: { orderRows: OrderReportRow[]; staffRows: StaffReportRow[] }) => void;
  disabled?: boolean;
}

const normalize = (s: string) =>
  (s || '')
    .replace(/[\u200c\u200f\u200e]/g, '')
    .replace(/[ىي]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export function ReportBotDialog({ orders, dateLabel, onApply, disabled }: ReportBotDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryItem[]>([]);
  const [bankCards, setBankCards] = useState<{ id: string; card_name: string; bank_name?: string | null }[]>([]);
  const [preview, setPreview] = useState<{
    orderRows: OrderReportRow[];
    staffRows: StaffReportRow[];
    summary: string;
    unmatchedOrders: string[];
    unmatchedStaff: string[];
  } | null>(null);


  // Load staff directory (HR employees + salary settings) for name → code matching
  useEffect(() => {
    if (!open || staffDirectory.length > 0) return;
    (async () => {
      try {
        const [{ data: hr }, { data: salary }] = await Promise.all([
          supabase.from('hr_employees').select('id, phone_number, full_name, user_id'),
          supabase.from('staff_salary_settings').select('staff_code, staff_name'),
        ]);

        const items: StaffDirectoryItem[] = [];
        (hr || []).forEach((h: any) => {
          const code = String(h.phone_number || '').trim() || (h.id ? `HR-${String(h.id).slice(-6)}` : '');
          const name = String(h.full_name || '').trim();
          if (code && name) items.push({ code, name, user_id: h.user_id ? String(h.user_id) : null });
        });
        (salary || []).forEach((s: any) => {
          const code = String(s.staff_code || '').trim();
          let name = String(s.staff_name || '').trim();
          if (name.startsWith(`${code} -`)) name = name.slice(code.length + 2).trim();
          if (code && name && !items.some((i) => i.code === code)) items.push({ code, name });
        });
        setStaffDirectory(items);
      } catch (e) {
        console.error('Error loading staff directory for bot:', e);
      }
    })();
  }, [open, staffDirectory.length]);

  // Load active bank cards so the bot can detect "کارت ملت اجرایی/پشتیبانی/مدیریت"
  useEffect(() => {
    if (!open || bankCards.length > 0) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('bank_cards')
          .select('id, card_name, bank_name')
          .eq('is_active', true);
        setBankCards((data || []) as any);
      } catch (e) {
        console.error('Error loading bank cards for bot:', e);
      }
    })();
  }, [open, bankCards.length]);


  const findStaff = (code: string, name: string): StaffDirectoryItem | undefined => {
    if (code) {
      const byCode = staffDirectory.find((s) => s.code === code);
      if (byCode) return byCode;
    }
    const n = normalize(name);
    if (!n) return undefined;
    return (
      staffDirectory.find((s) => normalize(s.name) === n) ||
      staffDirectory.find((s) => normalize(s.name).includes(n) || n.includes(normalize(s.name)))
    );
  };

  const findOrder = (orderId: string, label: string): Order | undefined => {
    if (orderId) {
      const byId = orders.find((o) => o.id === orderId);
      if (byId) return byId;
    }
    const l = normalize(label);
    if (!l) return undefined;
    return (
      orders.find((o) => normalize(o.customer_name || '') === l) ||
      orders.find(
        (o) =>
          normalize(o.customer_name || '').includes(l) ||
          l.includes(normalize(o.customer_name || '')) ||
          normalize(o.address || '').includes(l),
      )
    );
  };
  const getCardLabel = (cardId: string) => {
    const c = bankCards.find((x) => x.id === cardId);
    return c ? `${c.card_name}${c.bank_name ? ` (${c.bank_name})` : ''}` : '';
  };


  const handleAnalyze = async () => {
    if (!text.trim()) {
      toast.error('متن گزارش را وارد کنید');
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke('parse-report-text', {
        body: {
          text,
          extraInstructions: extra || undefined,
          staffDirectory: staffDirectory.map((s) => ({ code: s.code, name: s.name })),
          bankCardsDirectory: bankCards.map((c) => ({ id: c.id, card_name: c.card_name, bank_name: c.bank_name })),
          ordersDirectory: orders.slice(0, 400).map((o) => ({
            id: o.id,
            code: o.code,
            customer_name: o.customer_name,
            address: o.address,
            subcategory_name: o.subcategory_name,
          })),
        },

      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'خطا در تحلیل متن');

      const unmatchedOrders: string[] = [];
      const unmatchedStaff: string[] = [];

      const orderRows: OrderReportRow[] = (data.orderRows || []).map((r: any, idx: number) => {
        const matched = findOrder(String(r.order_id || ''), String(r.matched_label || ''));
        if (!matched && r.matched_label) unmatchedOrders.push(String(r.matched_label));
        return {
          order_id: matched?.id || '',
          activity_description: String(r.activity_description || ''),
          service_details: String(r.service_details || ''),
          team_name: String(r.team_name || ''),
          notes: String(r.notes || ''),
          row_color: ROW_COLORS[idx % ROW_COLORS.length].value,
        };
      });

      const staffRows: StaffReportRow[] = (data.staffRows || []).map((r: any) => {
        const rawName = String(r.staff_name || '').trim();
        const matched = findStaff(String(r.staff_code || ''), rawName);
        if (!matched && rawName) unmatchedStaff.push(rawName);

        // Match bank card by id, or by name mentioned in the text
        const cardName = normalize(String(r.bank_card_name || ''));
        const card =
          bankCards.find((c) => c.id === String(r.bank_card_id || '')) ||
          (cardName
            ? bankCards.find((c) => normalize(c.card_name) === cardName) ||
              bankCards.find(
                (c) => normalize(c.card_name).includes(cardName) || cardName.includes(normalize(c.card_name)),
              )
            : undefined);

        return {
          staff_user_id: matched?.code || null,
          real_user_id: matched?.user_id || null,
          staff_name: matched ? `${matched.code} - ${matched.name}` : rawName,
          work_status: r.work_status === 'غایب' ? 'غایب' : 'کارکرده',
          overtime_hours: Number(r.overtime_hours) || 0,
          amount_received: Number(r.amount_received) || 0,
          receiving_notes: String(r.receiving_notes || ''),
          amount_spent: Number(r.amount_spent) || 0,
          spending_notes: String(r.spending_notes || ''),
          notes: String(r.notes || ''),
          is_cash_box: false,
          is_company_expense: false,
          bank_card_id: card?.id || null,
          transaction_time: null,
        } as StaffReportRow;
      });


      if (orderRows.length === 0 && staffRows.length === 0) {
        toast.error('چیزی برای پرکردن جداول پیدا نشد');
        return;
      }

      setPreview({
        orderRows,
        staffRows,
        summary: String(data.summary || ''),
        unmatchedOrders,
        unmatchedStaff,
      });
    } catch (e: any) {
      console.error('ReportBot error:', e);
      toast.error(e?.message || 'خطا در ربات پرکردن گزارش');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    onApply({ orderRows: preview.orderRows, staffRows: preview.staffRows });
    toast.success('جداول با اطلاعات ربات پر شد');
    setOpen(false);
    setPreview(null);
    setText('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2 border-violet-500 text-violet-600 hover:bg-violet-50">
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">ربات پرکردن گزارش</span>
          <span className="sm:hidden">ربات</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-600" />
            ربات پرکردن گزارش
          </DialogTitle>
          <DialogDescription>
            متن گزارش روز را بنویسید یا کپی کنید؛ ربات جدول سفارشات و جدول نیروها را برای{' '}
            {dateLabel ? `تاریخ ${dateLabel}` : 'تاریخ انتخاب‌شده'} پر می‌کند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>متن گزارش</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              dir="rtl"
              placeholder="گزارش امروز را در اینجا توضیح دهید"
            />
          </div>

          <div className="space-y-2">
            <Label>توضیحات تکمیلی برای ربات (اختیاری)</Label>
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              dir="rtl"
              placeholder="مثلاً: مبالغ را به تومان و در ستون دریافتی ثبت کن"
            />
          </div>

          <Button onClick={handleAnalyze} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'در حال تحلیل متن...' : 'تحلیل هوشمند متن'}
          </Button>

          {preview && (
            <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
              {preview.summary && <p className="text-sm text-muted-foreground">{preview.summary}</p>}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Package className="h-3 w-3" /> {preview.orderRows.length} ردیف سفارش
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" /> {preview.staffRows.length} ردیف نیرو
                </Badge>
              </div>

              {(preview.unmatchedOrders.length > 0 || preview.unmatchedStaff.length > 0) && (
                <p className="text-xs text-amber-600">
                  موارد بدون تطبیق (باید دستی انتخاب شوند):{' '}
                  {[...preview.unmatchedOrders, ...preview.unmatchedStaff].join('، ')}
                </p>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-blue-600">سفارشات شناسایی‌شده ({preview.orderRows.length})</p>
                <div className="space-y-2">
                  {preview.orderRows.map((r, i) => {
                    const o = orders.find((x) => x.id === r.order_id);
                    return (
                      <div key={`o-${i}`} className="text-xs rounded border bg-background p-2">
                        <span className="font-semibold text-blue-600">
                          {o ? `${o.code} - ${o.customer_name || ''}` : 'سفارش نامشخص'}
                        </span>
                        {' — '}
                        {r.activity_description}
                        {r.team_name && <span className="text-muted-foreground"> | اکیپ: {r.team_name}</span>}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs font-semibold text-amber-600">
                  نیروهای شناسایی‌شده ({preview.staffRows.length})
                </p>
                <div className="space-y-2">
                  {preview.staffRows.map((r, i) => (
                    <div key={`s-${i}`} className="text-xs rounded border bg-background p-2 space-y-1">
                      <div>
                        <span className="font-semibold text-amber-600">{r.staff_name || 'نیروی نامشخص'}</span>
                        {' — '}
                        {r.work_status}
                        {r.overtime_hours ? <span> | اضافه‌کاری: {r.overtime_hours}</span> : null}
                      </div>
                      {r.amount_received ? (
                        <div className="text-green-700">
                          دریافتی: {r.amount_received.toLocaleString('en-US')}
                          {r.receiving_notes ? ` (${r.receiving_notes})` : ''}
                          {r.bank_card_id ? ` | ${getCardLabel(r.bank_card_id)}` : ''}
                        </div>
                      ) : null}
                      {r.amount_spent ? (
                        <div className="text-red-700">
                          پرداختی: {r.amount_spent.toLocaleString('en-US')}
                          {r.spending_notes ? ` (${r.spending_notes})` : ''}
                        </div>
                      ) : null}
                      {r.notes ? <div className="text-muted-foreground">{r.notes}</div> : null}
                    </div>
                  ))}
                </div>
              </div>


              <Button onClick={handleApply} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4" />
                پرکردن جداول این روز
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
