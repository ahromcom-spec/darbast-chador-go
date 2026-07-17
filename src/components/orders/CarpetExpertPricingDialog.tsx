import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2, Truck, ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { useToast } from '@/hooks/use-toast';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { sanitizeHtml } from '@/lib/security';
import { useNavigate } from 'react-router-dom';

const ITEM_CATALOG: { id: string; label: string; needsDims?: boolean }[] = [
  { id: 'carpet_12', label: 'فرش ۱۲ متری' },
  { id: 'carpet_9',  label: 'فرش ۹ متری' },
  { id: 'carpet_6',  label: 'فرش ۶ متری' },
  { id: 'carpet_custom', label: 'فرش با ابعاد سفارشی', needsDims: true },
  { id: 'moquette_standard', label: 'موکت معمولی', needsDims: true },
  { id: 'moquette_palaz', label: 'پالاز موکت', needsDims: true },
];

interface Row {
  rowId: string;
  itemId: string;
  quantity: number;
  length: string;
  width: string;
}

interface Props {
  subcategoryId: string;
  provinceId: string;
  districtId?: string;
  address: string;
  detailedAddress?: string;
  locationLat?: number;
  locationLng?: number;
  serviceTypeName?: string;
  hierarchyProjectId?: string;
  locationId?: string;
  serviceTypeId?: string;
}

type Mode = 'declare' | 'pickup';

export const CarpetExpertPricingDialog = ({
  subcategoryId, provinceId, districtId, address, detailedAddress,
  locationLat, locationLng, serviceTypeName, hierarchyProjectId,
  locationId, serviceTypeId,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('declare');
  const [rows, setRows] = useState<Row[]>([]);
  const [pickerValue, setPickerValue] = useState('');
  const [approxCount, setApproxCount] = useState('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const { customerId } = useCustomer();
  const { toast } = useToast();
  const { getOrCreateProject } = useProjectsHierarchy();
  const navigate = useNavigate();

  const addRow = (id: string) => {
    if (!id) return;
    setRows(p => [...p, {
      rowId: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemId: id, quantity: 1, length: '', width: '',
    }]);
    setPickerValue('');
  };
  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows(p => p.map(r => (r.rowId === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows(p => p.filter(r => r.rowId !== id));

  const totalItems = useMemo(() => rows.reduce((s, r) => s + r.quantity, 0), [rows]);

  const handleSubmit = async () => {
    if (!user || !customerId) {
      toast({ title: 'ورود نشده', description: 'ابتدا وارد حساب شوید.', variant: 'destructive' });
      return;
    }
    if (mode === 'declare' && rows.length === 0) {
      toast({ title: 'آیتمی اضافه نشده', description: 'حداقل یک آیتم اضافه کنید یا حالت «تحویل برای شمارش» را انتخاب کنید.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let finalHierarchyProjectId = hierarchyProjectId || null;
      if (!finalHierarchyProjectId && locationId && serviceTypeId && subcategoryId) {
        finalHierarchyProjectId = await getOrCreateProject(locationId, serviceTypeId, subcategoryId);
      }

      if (!finalHierarchyProjectId) {
        throw new Error('شناسه پروژه برای ثبت درخواست پیدا نشد. لطفاً آدرس را دوباره انتخاب کنید.');
      }

      const items = rows.map(r => {
        const item = ITEM_CATALOG.find(i => i.id === r.itemId);
        const L = parseLocalizedNumber(r.length);
        const W = parseLocalizedNumber(r.width);
        return {
          id: r.itemId,
          label: item?.label,
          quantity: r.quantity,
          length: r.length ? L : null,
          width: r.width ? W : null,
          area_m2: L > 0 && W > 0 ? L * W : null,
        };
      });

      const notes = {
        service_type: 'carpet_cleaning',
        is_expert_pricing_request: true,
        expert_mode: mode, // 'declare' | 'pickup'
        items: mode === 'declare' ? items : [],
        total_declared_count: mode === 'declare' ? totalItems : null,
        approx_count: mode === 'pickup' ? (parseLocalizedNumber(approxCount) || null) : null,
        description: description || undefined,
        contact_phone: contactPhone || undefined,
        customerName: user?.user_metadata?.full_name || '',
        phoneNumber: user?.phone || contactPhone || '',
      };

      const { data, error } = await supabase.rpc('create_project_v3', {
        _customer_id: customerId,
        _province_id: provinceId,
        _district_id: districtId || null,
        _subcategory_id: subcategoryId,
        _hierarchy_project_id: finalHierarchyProjectId,
        _address: sanitizeHtml(address),
        _detailed_address: detailedAddress ? sanitizeHtml(detailedAddress) : null,
        _location_lat: typeof locationLat === 'number' ? locationLat : null,
        _location_lng: typeof locationLng === 'number' ? locationLng : null,
        _notes: JSON.stringify(notes),
      } as any);

      if (error) throw error;
      const created: any = Array.isArray(data) ? data[0] : data;
      toast({
        title: '✅ درخواست ثبت شد',
        description: mode === 'pickup'
          ? 'کارشناس ما برای تحویل و شمارش فرش‌ها با شما تماس می‌گیرد.'
          : 'درخواست شما برای قیمت‌گذاری کارشناسی ثبت شد.',
      });
      setOpen(false);
      setRows([]); setApproxCount(''); setDescription(''); setContactPhone('');
      if (created?.id) navigate(`/user/orders/${created.id}`);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'خطا در ثبت', description: e?.message || 'ناموفق', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
          درخواست قیمت‌گذاری توسط کارشناس
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            درخواست قیمت‌گذاری کارشناسی قالی شویی
          </DialogTitle>
          <DialogDescription>
            یکی از دو روش زیر را انتخاب کنید. تکمیل ابعاد و تعداد فقط در حالتی که خودتان می‌خواهید اطلاعات دقیق بدهید ضروری است.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Mode selector */}
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition ${mode === 'declare' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="declare" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  خودم تعداد و ابعاد را مشخص می‌کنم
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  آیتم‌های فرش/موکت را با تعداد و در صورت لزوم ابعاد وارد کنید تا کارشناس دقیق‌ترین قیمت را بدهد.
                </p>
              </div>
            </label>
            <label className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition ${mode === 'pickup' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="pickup" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Truck className="w-4 h-4 text-primary" />
                  فرش‌ها را ببرید، شما شمارش و قیمت‌گذاری کنید
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  همکاران ما در محل، فرش‌ها را تحویل گرفته و پس از شمارش دقیق، قیمت را اعلام می‌کنند.
                </p>
              </div>
            </label>
          </RadioGroup>

          {mode === 'declare' ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={pickerValue} onValueChange={setPickerValue}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="یک آیتم انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CATALOG.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => addRow(pickerValue)} disabled={!pickerValue} className="gap-1">
                  <Plus className="w-4 h-4" /> افزودن
                </Button>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  هنوز آیتمی اضافه نشده است.
                </div>
              ) : rows.map(row => {
                const item = ITEM_CATALOG.find(i => i.id === row.itemId);
                if (!item) return null;
                return (
                  <div key={row.rowId} className="rounded-lg border p-3 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeRow(row.rowId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {item.needsDims && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">طول (متر) — اختیاری</Label>
                          <Input dir="ltr" className="text-left" inputMode="decimal" value={row.length}
                            onChange={e => updateRow(row.rowId, { length: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">عرض (متر) — اختیاری</Label>
                          <Input dir="ltr" className="text-left" inputMode="decimal" value={row.width}
                            onChange={e => updateRow(row.rowId, { width: e.target.value })} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">تعداد:</span>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => updateRow(row.rowId, { quantity: Math.max(1, row.quantity - 1) })}>
                        −
                      </Button>
                      <span className="w-10 text-center font-bold">{row.quantity}</span>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => updateRow(row.rowId, { quantity: row.quantity + 1 })}>
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
              <Label className="text-sm">تعداد تقریبی فرش/موکت (اختیاری)</Label>
              <Input dir="ltr" className="text-left" inputMode="numeric" placeholder="مثلاً ۵"
                value={approxCount} onChange={e => setApproxCount(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                در صورت اطلاع از تعداد تقریبی وارد کنید. کارشناسان ما در محل شمارش نهایی را انجام می‌دهند.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">توضیحات (اختیاری)</Label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="نکاتی مثل جنس فرش، لکه‌های خاص، زمان مناسب برای تماس..." />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">شماره تماس (اختیاری)</Label>
            <Input dir="ltr" className="text-left" inputMode="tel" placeholder="09xxxxxxxxx"
              value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={submitting}>
              انصراف
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              ثبت درخواست کارشناسی
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CarpetExpertPricingDialog;
