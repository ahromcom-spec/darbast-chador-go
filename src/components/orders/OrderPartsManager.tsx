import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PersianDatePicker } from '@/components/ui/persian-date-picker';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import {
  Plus,
  Trash2,
  Save,
  Layers,
  RefreshCw,
  PackageOpen,
  CheckCircle2,
  ChevronDown,
  Ruler,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { formatPersianDate } from '@/lib/dateUtils';
import { addMonths } from 'date-fns-jalali';

export const PART_ORDINALS = [
  'اول',
  'دوم',
  'سوم',
  'چهارم',
  'پنجم',
  'ششم',
  'هفتم',
  'هشتم',
  'نهم',
  'دهم',
];

export const partLabel = (partNumber: number, title?: string | null) => {
  const base = `قسمت ${PART_ORDINALS[partNumber - 1] || partNumber} سفارش`;
  const extra = (title || '').trim();
  return extra ? `${base} - ${extra}` : base;
};

const PART_STATUS_LABELS: Record<string, string> = {
  active: 'فعال',
  awaiting_collection: 'در انتظار فک/جمع‌آوری',
  in_collection: 'در حال جمع‌آوری',
  collected: 'فک و جمع‌آوری شد',
  cancelled: 'لغو شده',
};

const PART_STATUS_CLASSES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  awaiting_collection: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_collection: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  collected: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface DimRow {
  length?: string;
  width?: string;
  height?: string;
}

export interface OrderPartRow {
  id: string;
  order_id: string;
  part_number: number;
  title: string | null;
  description: string | null;
  dimensions: DimRow[];
  total_area: number | null;
  price: number | null;
  rental_start_date: string | null;
  rental_end_date: string | null;
  status: string;
  collection_requested_at: string | null;
  collected_at: string | null;
  notes: string | null;
}

interface PartRenewal {
  id: string;
  part_id: string | null;
  renewal_number: number;
  renewal_price: number | null;
  new_start_date: string | null;
  new_end_date: string | null;
  status: string;
}

interface OrderPartsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    code: string;
    customer_id?: string | null;
    payment_amount?: number | null;
    total_price?: number | null;
    rental_start_date?: string | null;
    notes?: any;
  };
  onUpdated?: () => void;
}

const toDimRows = (value: any): DimRow[] => {
  if (!Array.isArray(value)) return [{ length: '', width: '', height: '' }];
  const rows = value.map((d: any) => ({
    length: d?.length !== undefined && d?.length !== null ? String(d.length) : '',
    width: d?.width !== undefined && d?.width !== null ? String(d.width) : '',
    height: d?.height !== undefined && d?.height !== null ? String(d.height) : '',
  }));
  return rows.length > 0 ? rows : [{ length: '', width: '', height: '' }];
};

const computeArea = (rows: DimRow[]) => {
  const hasWidth = rows.some((r) => parseLocalizedNumber(r.width || '') > 0);
  const total = rows.reduce((sum, r) => {
    const l = parseLocalizedNumber(r.length || '');
    const w = parseLocalizedNumber(r.width || '');
    const h = parseLocalizedNumber(r.height || '');
    if (l <= 0 || h <= 0) return sum;
    return sum + (hasWidth ? l * (w > 0 ? w : 1) * h : l * h);
  }, 0);
  return { total: Number(total.toFixed(2)), unit: hasWidth ? 'متر مکعب' : 'متر مربع' };
};

export function OrderPartsManager({ open, onOpenChange, order, onUpdated }: OrderPartsManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<OrderPartRow[]>([]);
  const [renewals, setRenewals] = useState<PartRenewal[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { title: string; description: string; price: string; rental_start_date: string; dims: DimRow[] }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState('2');
  const [splitting, setSplitting] = useState(false);
  const [openPartId, setOpenPartId] = useState<string | null>(null);
  const [renewalPrice, setRenewalPrice] = useState<Record<string, string>>({});

  const orderNotes = useMemo(() => {
    if (!order?.notes) return null;
    try {
      return typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
    } catch {
      return null;
    }
  }, [order?.notes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: partsData, error: partsError }, { data: renewalData }] = await Promise.all([
        supabase.from('order_parts').select('*').eq('order_id', order.id).order('part_number', { ascending: true }),
        supabase
          .from('order_renewals')
          .select('id, part_id, renewal_number, renewal_price, new_start_date, new_end_date, status')
          .eq('order_id', order.id)
          .order('renewal_number', { ascending: true }),
      ]);
      if (partsError) throw partsError;

      const rows: OrderPartRow[] = (partsData || []).map((p: any) => ({
        ...p,
        dimensions: Array.isArray(p.dimensions) ? p.dimensions : [],
      }));
      setParts(rows);
      setRenewals((renewalData || []) as PartRenewal[]);
      setDrafts(
        rows.reduce((acc, p) => {
          acc[p.id] = {
            title: p.title || '',
            description: p.description || '',
            price: p.price ? String(p.price) : '',
            rental_start_date: p.rental_start_date || '',
            dims: toDimRows(p.dimensions),
          };
          return acc;
        }, {} as Record<string, any>),
      );
      if (rows.length > 0) {
        setOpenPartId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0].id));
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'دریافت قسمت‌های سفارش با خطا مواجه شد' });
    } finally {
      setLoading(false);
    }
  }, [order.id, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const partsSum = parts
    .filter((p) => p.status !== 'cancelled')
    .reduce((s, p) => s + Number(p.price || 0), 0);

  const splitOrder = async () => {
    const count = Math.max(2, Math.min(10, Math.round(parseLocalizedNumber(splitCount) || 2)));
    setSplitting(true);
    try {
      const basePrice = Number(order.payment_amount || 0);
      const per = basePrice > 0 ? Math.round(basePrice / count) : 0;
      const baseDims = Array.isArray(orderNotes?.dimensions) ? orderNotes.dimensions : [];
      const baseDescription = orderNotes?.description || orderNotes?.installationDescription || orderNotes?.additional_notes || '';

      const rows = Array.from({ length: count }, (_, i) => ({
        order_id: order.id,
        part_number: i + 1,
        title: null,
        description: i === 0 ? baseDescription || null : null,
        dimensions: i === 0 && baseDims.length > 0 ? baseDims : [],
        price: i === count - 1 ? Math.max(0, basePrice - per * (count - 1)) : per,
        rental_start_date: order.rental_start_date || null,
        status: 'active',
        created_by: user?.id || null,
      }));

      const { error } = await supabase.from('order_parts').insert(rows as any);
      if (error) throw error;
      toast({ title: '✓ سفارش تقسیم شد', description: `سفارش ${order.code} به ${count} قسمت تقسیم شد.` });
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'تقسیم سفارش با خطا مواجه شد' });
    } finally {
      setSplitting(false);
    }
  };

  const addPart = async () => {
    setSplitting(true);
    try {
      const nextNumber = parts.length > 0 ? Math.max(...parts.map((p) => p.part_number)) + 1 : 1;
      const { error } = await supabase.from('order_parts').insert({
        order_id: order.id,
        part_number: nextNumber,
        dimensions: [],
        price: 0,
        rental_start_date: order.rental_start_date || null,
        status: 'active',
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'افزودن قسمت با خطا مواجه شد' });
    } finally {
      setSplitting(false);
    }
  };

  const savePart = async (part: OrderPartRow) => {
    const draft = drafts[part.id];
    if (!draft) return;
    setSavingId(part.id);
    try {
      const dims = draft.dims
        .filter((d) => parseLocalizedNumber(d.length || '') > 0 || parseLocalizedNumber(d.height || '') > 0)
        .map((d) => ({
          length: parseLocalizedNumber(d.length || '') || 0,
          width: parseLocalizedNumber(d.width || '') || 0,
          height: parseLocalizedNumber(d.height || '') || 0,
        }));
      const { total } = computeArea(draft.dims);
      const start = draft.rental_start_date || null;
      const end = start ? addMonths(new Date(start), 1).toISOString() : null;

      const { error } = await supabase
        .from('order_parts')
        .update({
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          dimensions: dims as any,
          total_area: total > 0 ? total : null,
          price: parseLocalizedNumber(draft.price) || 0,
          rental_start_date: start,
          rental_end_date: end,
        })
        .eq('id', part.id);
      if (error) throw error;
      toast({ title: '✓ ذخیره شد', description: `${partLabel(part.part_number, draft.title)} به‌روزرسانی شد.` });
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'ذخیره قسمت با خطا مواجه شد' });
    } finally {
      setSavingId(null);
    }
  };

  const deletePart = async (part: OrderPartRow) => {
    setBusyId(part.id);
    try {
      const { error } = await supabase.from('order_parts').delete().eq('id', part.id);
      if (error) throw error;
      toast({ title: 'قسمت حذف شد' });
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'حذف قسمت با خطا مواجه شد' });
    } finally {
      setBusyId(null);
    }
  };

  const requestCollection = async (part: OrderPartRow) => {
    if (!order.customer_id) {
      toast({ variant: 'destructive', title: 'خطا', description: 'مشتری این سفارش مشخص نیست' });
      return;
    }
    setBusyId(part.id);
    try {
      // اگر تاریخ درخواست به‌صورت دستی وارد شده، همان استفاده شود
      const reqDate = part.collection_requested_at || new Date().toISOString();
      const { error } = await supabase.from('collection_requests').insert({
        order_id: order.id,
        part_id: part.id,
        customer_id: order.customer_id,
        description: `درخواست فک ${partLabel(part.part_number, part.title)}`,
        requested_date: reqDate,
        status: 'pending',
      } as any);
      if (error) throw error;
      await supabase
        .from('order_parts')
        .update({ status: 'awaiting_collection', collection_requested_at: reqDate })
        .eq('id', part.id);
      toast({ title: '✓ درخواست فک ثبت شد', description: partLabel(part.part_number, part.title) });
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'ثبت درخواست فک با خطا مواجه شد' });
    } finally {
      setBusyId(null);
    }
  };

  const markCollected = async (part: OrderPartRow) => {
    setBusyId(part.id);
    try {
      // اگر تاریخ فک به‌صورت دستی وارد شده، همان استفاده شود
      const collectedDate = part.collected_at || new Date().toISOString();
      const { error } = await supabase
        .from('order_parts')
        .update({ status: 'collected', collected_at: collectedDate })
        .eq('id', part.id);
      if (error) throw error;
      // آخرین درخواست فک این قسمت را تکمیل‌شده علامت بزن
      await supabase
        .from('collection_requests')
        .update({ status: 'completed', completed_at: collectedDate } as any)
        .eq('part_id', part.id)
        .neq('status', 'completed');
      toast({ title: '✓ ثبت شد', description: `${partLabel(part.part_number, part.title)} فک و جمع‌آوری شد.` });
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'ثبت فک با خطا مواجه شد' });
    } finally {
      setBusyId(null);
    }
  };

  // ویرایش دستی تاریخ درخواست فک / تاریخ فک شدن
  const updatePartDate = async (
    part: OrderPartRow,
    field: 'collection_requested_at' | 'collected_at',
    value: string | null
  ) => {
    setBusyId(part.id);
    try {
      const { error } = await supabase
        .from('order_parts')
        .update({ [field]: value } as any)
        .eq('id', part.id);
      if (error) throw error;
      // همگام‌سازی با درخواست فک مرتبط
      if (field === 'collection_requested_at' && value) {
        await supabase
          .from('collection_requests')
          .update({ requested_date: value } as any)
          .eq('part_id', part.id);
      }
      if (field === 'collected_at' && value) {
        await supabase
          .from('collection_requests')
          .update({ status: 'completed', completed_at: value } as any)
          .eq('part_id', part.id)
          .neq('status', 'completed');
      }
      await load();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'ویرایش تاریخ با خطا مواجه شد' });
    } finally {
      setBusyId(null);
    }
  };

  const reopenPart = async (part: OrderPartRow) => {
    setBusyId(part.id);
    try {
      const { error } = await supabase
        .from('order_parts')
        .update({ status: 'active', collected_at: null, collection_requested_at: null })
        .eq('id', part.id);
      if (error) throw error;
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'تغییر وضعیت با خطا مواجه شد' });
    } finally {
      setBusyId(null);
    }
  };

  const addRenewal = async (part: OrderPartRow) => {
    if (!order.customer_id) {
      toast({ variant: 'destructive', title: 'خطا', description: 'مشتری این سفارش مشخص نیست' });
      return;
    }
    const price = parseLocalizedNumber(renewalPrice[part.id] || '') || Number(part.price || 0);
    if (price <= 0) {
      toast({ variant: 'destructive', title: 'مبلغ تمدید را وارد کنید' });
      return;
    }
    setBusyId(part.id);
    try {
      const partRenewals = renewals.filter((r) => r.part_id === part.id && r.status !== 'rejected');
      const lastEnd = partRenewals.length > 0
        ? partRenewals.reduce((prev, cur) => (prev.renewal_number > cur.renewal_number ? prev : cur)).new_end_date
        : part.rental_end_date || (part.rental_start_date ? addMonths(new Date(part.rental_start_date), 1).toISOString() : null);
      const startDate = lastEnd ? new Date(lastEnd) : new Date();
      const nextNumber = partRenewals.length > 0
        ? Math.max(...partRenewals.map((r) => r.renewal_number)) + 1
        : 1;
      if (nextNumber > 12) {
        toast({ variant: 'destructive', title: 'حداکثر ۱۲ تمدید برای هر قسمت مجاز است' });
        return;
      }

      const { error } = await supabase.from('order_renewals').insert({
        order_id: order.id,
        part_id: part.id,
        customer_id: order.customer_id,
        renewal_number: nextNumber,
        previous_end_date: lastEnd,
        new_start_date: startDate.toISOString(),
        new_end_date: addMonths(startDate, 1).toISOString(),
        original_price: Number(part.price || 0),
        renewal_price: price,
        status: 'approved',
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      setRenewalPrice((prev) => ({ ...prev, [part.id]: '' }));
      toast({ title: '✓ تمدید ثبت شد', description: partLabel(part.part_number, part.title) });
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'ثبت تمدید با خطا مواجه شد' });
    } finally {
      setBusyId(null);
    }
  };

  const deleteRenewal = async (renewalId: string, partId: string) => {
    setBusyId(partId);
    try {
      const { error } = await supabase.from('order_renewals').delete().eq('id', renewalId);
      if (error) throw error;
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطا', description: err.message || 'حذف تمدید با خطا مواجه شد' });
    } finally {
      setBusyId(null);
    }
  };

  const updateDraft = (partId: string, patch: Partial<{ title: string; description: string; price: string; rental_start_date: string; dims: DimRow[] }>) => {
    setDrafts((prev) => ({ ...prev, [partId]: { ...prev[partId], ...patch } }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            قسمت‌های سفارش {order.code}
          </DialogTitle>
          <DialogDescription>
            تقسیم سفارش به چند قسمت، قیمت‌گذاری، ابعاد، شرح خدمات، تمدید و فک جداگانه هر قسمت
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10">
            <LoadingSpinner size="lg" text="در حال بارگذاری قسمت‌ها..." />
          </div>
        ) : (
          <div className="space-y-4">
            {/* خلاصه */}
            <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">تعداد قسمت‌ها</span>
                <span className="font-bold">{parts.length.toLocaleString('fa-IR')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">جمع مبلغ قسمت‌ها</span>
                <span className="font-bold" dir="ltr">{partsSum.toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">مبلغ کل سفارش (با تمدید و تعمیرات)</span>
                <span className="font-bold" dir="ltr">{Number(order.total_price || 0).toLocaleString('fa-IR')} تومان</span>
              </div>
              {parts.length > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  با ثبت قسمت‌ها، مبلغ پایه سفارش و فاکتور خودکار از جمع مبلغ قسمت‌ها محاسبه می‌شود.
                </p>
              )}
            </div>

            {/* تقسیم اولیه */}
            {parts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 space-y-3">
                <p className="text-sm">
                  این سفارش هنوز تقسیم نشده است. تعداد قسمت‌ها را انتخاب کنید (مثلاً چهار طرف ساختمان یا دو چهارپایه):
                </p>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-xs">تعداد قسمت‌ها</Label>
                    <Input
                      className="w-24"
                      value={splitCount}
                      onChange={(e) => setSplitCount(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="flex gap-2">
                    {[2, 3, 4].map((n) => (
                      <Button key={n} type="button" variant="outline" size="sm" onClick={() => setSplitCount(String(n))}>
                        {n.toLocaleString('fa-IR')} قسمت
                      </Button>
                    ))}
                  </div>
                  <Button onClick={splitOrder} disabled={splitting} className="gap-2">
                    {splitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                    تقسیم سفارش
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  مبلغ فعلی سفارش به‌طور مساوی بین قسمت‌ها تقسیم می‌شود و بعد می‌توانید مبلغ هر قسمت را جدا تغییر دهید.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={addPart} disabled={splitting}>
                  <Plus className="h-4 w-4" />
                  افزودن قسمت جدید
                </Button>
                <Button variant="ghost" size="sm" className="gap-2" onClick={load}>
                  <RefreshCw className="h-4 w-4" />
                  به‌روزرسانی
                </Button>
              </div>
            )}

            {/* لیست قسمت‌ها */}
            <div className="space-y-3">
              {parts.map((part) => {
                const draft = drafts[part.id] || { title: '', description: '', price: '', rental_start_date: '', dims: [{}] };
                const area = computeArea(draft.dims);
                const partRenewals = renewals.filter((r) => r.part_id === part.id);
                const isOpen = openPartId === part.id;
                return (
                  <Collapsible
                    key={part.id}
                    open={isOpen}
                    onOpenChange={(v) => setOpenPartId(v ? part.id : null)}
                    className="rounded-lg border"
                  >
                    <CollapsibleTrigger className="w-full p-3 flex items-center justify-between gap-2 text-right">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{partLabel(part.part_number, part.title)}</span>
                        <Badge className={PART_STATUS_CLASSES[part.status]}>{PART_STATUS_LABELS[part.status] || part.status}</Badge>
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {Number(part.price || 0).toLocaleString('fa-IR')} تومان
                        </span>
                        {partRenewals.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {partRenewals.length.toLocaleString('fa-IR')} تمدید
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="p-3 pt-0 space-y-4">
                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">نام قسمت (اختیاری)</Label>
                          <Input
                            placeholder="مثلاً ضلع شمالی / چهارپایه اول"
                            value={draft.title}
                            onChange={(e) => updateDraft(part.id, { title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">مبلغ این قسمت (تومان)</Label>
                          <Input
                            dir="ltr"
                            inputMode="numeric"
                            value={draft.price}
                            onChange={(e) => updateDraft(part.id, { price: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">شرح خدمات این قسمت</Label>
                        <Textarea
                          rows={2}
                          placeholder="شرح محل نصب و نوع فعالیت این قسمت"
                          value={draft.description}
                          onChange={(e) => updateDraft(part.id, { description: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs flex items-center gap-1">
                            <Ruler className="h-3.5 w-3.5" />
                            ابعاد این قسمت
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {area.total > 0 ? `${area.total.toLocaleString('fa-IR')} ${area.unit}` : '—'}
                          </span>
                        </div>
                        {draft.dims.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              className="text-center"
                              placeholder="طول"
                              dir="ltr"
                              value={row.length || ''}
                              onChange={(e) => {
                                const dims = [...draft.dims];
                                dims[idx] = { ...dims[idx], length: e.target.value };
                                updateDraft(part.id, { dims });
                              }}
                            />
                            <Input
                              className="text-center"
                              placeholder="عرض"
                              dir="ltr"
                              value={row.width || ''}
                              onChange={(e) => {
                                const dims = [...draft.dims];
                                dims[idx] = { ...dims[idx], width: e.target.value };
                                updateDraft(part.id, { dims });
                              }}
                            />
                            <Input
                              className="text-center"
                              placeholder="ارتفاع"
                              dir="ltr"
                              value={row.height || ''}
                              onChange={(e) => {
                                const dims = [...draft.dims];
                                dims[idx] = { ...dims[idx], height: e.target.value };
                                updateDraft(part.id, { dims });
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const dims = draft.dims.filter((_, i) => i !== idx);
                                updateDraft(part.id, { dims: dims.length > 0 ? dims : [{ length: '', width: '', height: '' }] });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => updateDraft(part.id, { dims: [...draft.dims, { length: '', width: '', height: '' }] })}
                        >
                          <Plus className="h-4 w-4" />
                          افزودن ردیف ابعاد
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">تاریخ شروع کرایه این قسمت</Label>
                        <PersianDatePicker
                          timeMode="none"
                          value={draft.rental_start_date || undefined}
                          onChange={(v) => updateDraft(part.id, { rental_start_date: v })}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="gap-2" onClick={() => savePart(part)} disabled={savingId === part.id}>
                          {savingId === part.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          ذخیره قسمت
                        </Button>
                        {part.status !== 'collected' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => requestCollection(part)}
                              disabled={busyId === part.id}
                            >
                              <PackageOpen className="h-4 w-4" />
                              درخواست فک این قسمت
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 text-green-700 dark:text-green-400"
                              onClick={() => markCollected(part)}
                              disabled={busyId === part.id}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              این قسمت فک شد
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => reopenPart(part)} disabled={busyId === part.id}>
                            <RefreshCw className="h-4 w-4" />
                            بازگشت به حالت فعال
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 text-destructive"
                          onClick={() => deletePart(part)}
                          disabled={busyId === part.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          حذف قسمت
                        </Button>
                      </div>

                      {(part.collection_requested_at || part.collected_at) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {part.collection_requested_at && (
                            <p>تاریخ درخواست فک: {formatPersianDate(part.collection_requested_at)}</p>
                          )}
                          {part.collected_at && <p>تاریخ فک شدن: {formatPersianDate(part.collected_at)}</p>}
                        </div>
                      )}

                      <Separator />

                      {/* تمدیدهای این قسمت */}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                          تمدیدهای این قسمت
                        </Label>
                        {partRenewals.length === 0 ? (
                          <p className="text-xs text-muted-foreground">تمدیدی برای این قسمت ثبت نشده است.</p>
                        ) : (
                          <div className="space-y-2">
                            {partRenewals.map((r) => (
                              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                                <div className="space-y-0.5">
                                  <p className="font-medium">تمدید ماه {(r.renewal_number + 1).toLocaleString('fa-IR')}</p>
                                  <p className="text-muted-foreground">
                                    {r.new_start_date ? formatPersianDate(r.new_start_date) : '-'} تا{' '}
                                    {r.new_end_date ? formatPersianDate(r.new_end_date) : '-'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold" dir="ltr">
                                    {Number(r.renewal_price || 0).toLocaleString('fa-IR')} تومان
                                  </span>
                                  <Button variant="ghost" size="icon" onClick={() => deleteRenewal(r.id, part.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-end gap-2">
                          <div className="space-y-1 flex-1">
                            <Label className="text-xs">مبلغ تمدید یک ماه (تومان)</Label>
                            <Input
                              dir="ltr"
                              inputMode="numeric"
                              placeholder={String(Number(part.price || 0) || '')}
                              value={renewalPrice[part.id] || ''}
                              onChange={(e) => setRenewalPrice((prev) => ({ ...prev, [part.id]: e.target.value }))}
                            />
                          </div>
                          <Button size="sm" className="gap-2" onClick={() => addRenewal(part)} disabled={busyId === part.id}>
                            <Plus className="h-4 w-4" />
                            ثبت تمدید
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default OrderPartsManager;
