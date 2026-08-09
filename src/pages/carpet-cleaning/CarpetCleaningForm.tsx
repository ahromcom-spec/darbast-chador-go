import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import React from 'react';
// Lightweight shims — framer-motion is not installed in this project.
const AnimatePresence: React.FC<{ children: React.ReactNode; initial?: boolean }> = ({ children }) => <>{children}</>;
const motion = new Proxy({} as any, {
  get: () => React.forwardRef<HTMLDivElement, any>(({ children, layout, initial, animate, exit, transition, ...rest }, ref) => (
    <div ref={ref} {...rest}>{children}</div>
  )),
});
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomer } from '@/hooks/useCustomer';
import { useToast } from '@/hooks/use-toast';
import { useProjectsHierarchy } from '@/hooks/useProjectsHierarchy';
import { createProjectV3Schema } from '@/lib/rpcValidation';
import { sanitizeHtml } from '@/lib/security';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { buildOrderSmsAddress, sendOrderSms, sendCeoNotificationSms } from '@/lib/orderSms';
import { notifyManagers } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CarpetExpertPricingDialog } from '@/components/orders/CarpetExpertPricingDialog';
import { useCarpetCleaningPricing } from '@/hooks/useCarpetCleaningPricing';
import {
  ArrowRight,
  Building2,
  MapPin,
  Package,
  Plus,
  Minus,
  Trash2,
  Calculator,
  Sparkles,
  Ruler,
  Layers,
  ClipboardCheck,
} from 'lucide-react';

/* ============================================================
   Catalog — قیمت‌ها به‌صورت پویا از ماژول قیمت‌گذاری CEO
   (subcategory_pricing_items) خوانده می‌شوند. مقادیر زیر
   صرفاً fallback هستند اگر ردیفی در دیتابیس یافت نشود.
   ============================================================ */
type CatalogItem =
  | { id: string; kind: 'fixed'; label: string; icon: React.ReactNode; price: number; group: 'carpet' | 'moquette' }
  | { id: string; kind: 'per_m2'; label: string; icon: React.ReactNode; pricePerM2: number; group: 'carpet' | 'moquette' };

type CatalogTemplate =
  | { id: string; kind: 'fixed'; defaultLabel: string; icon: React.ReactNode; defaultPrice: number; group: 'carpet' | 'moquette' }
  | { id: string; kind: 'per_m2'; defaultLabel: string; icon: React.ReactNode; defaultPricePerM2: number; group: 'carpet' | 'moquette' };

const CATALOG_TEMPLATE: CatalogTemplate[] = [
  { id: 'carpet_12', kind: 'fixed', defaultLabel: 'فرش ۱۲ متری', icon: <Layers className="w-4 h-4" />, defaultPrice: 350000, group: 'carpet' },
  { id: 'carpet_9',  kind: 'fixed', defaultLabel: 'فرش ۹ متری',  icon: <Layers className="w-4 h-4" />, defaultPrice: 270000, group: 'carpet' },
  { id: 'carpet_6',  kind: 'fixed', defaultLabel: 'فرش ۶ متری',  icon: <Layers className="w-4 h-4" />, defaultPrice: 180000, group: 'carpet' },
  { id: 'carpet_custom', kind: 'per_m2', defaultLabel: 'فرش با ابعاد سفارشی (غیر استاندارد)', icon: <Ruler className="w-4 h-4" />, defaultPricePerM2: 30000, group: 'carpet' },
  { id: 'moquette_standard', kind: 'per_m2', defaultLabel: 'موکت معمولی', icon: <Layers className="w-4 h-4" />, defaultPricePerM2: 25000, group: 'moquette' },
  { id: 'moquette_palaz',    kind: 'per_m2', defaultLabel: 'پالاز موکت',  icon: <Layers className="w-4 h-4" />, defaultPricePerM2: 35000, group: 'moquette' },
];

interface Row {
  rowId: string;
  itemId: string;
  quantity: number;
  length: string;
  width: string;
}

/* Persian digits + thousands separator */
const toFa = (n: number | string): string => {
  const s = typeof n === 'number' ? Math.round(n).toLocaleString('en-US') : String(n);
  return s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
};

export default function CarpetCleaningForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { customerId } = useCustomer();
  const { toast } = useToast();
  const { getOrCreateProject } = useProjectsHierarchy();
  const { items: pricingItems, get: getPrice } = useCarpetCleaningPricing();

  const CATALOG: CatalogItem[] = useMemo(
    () =>
      CATALOG_TEMPLATE.map(t => {
        const dbItem = pricingItems.find(p => p.key === t.id);
        const label = dbItem?.label || t.defaultLabel;
        if (t.kind === 'fixed') {
          return { id: t.id, kind: 'fixed', label, icon: t.icon, group: t.group, price: getPrice(t.id, t.defaultPrice) };
        }
        return { id: t.id, kind: 'per_m2', label, icon: t.icon, group: t.group, pricePerM2: getPrice(t.id, t.defaultPricePerM2) };
      }),
    [pricingItems, getPrice],
  );

  const state = (location.state || {}) as any;
  const {
    hierarchyProjectId,
    projectId,
    locationId,
    provinceId,
    districtId,
    subcategoryId,
    serviceName = 'قالی شویی',
    subcategoryName = 'خدمات عمومی',
    locationAddress,
    locationTitle,
    provinceName,
    districtName,
    lat,
    lng,
  } = state;

  useEffect(() => {
    if (!locationAddress || !subcategoryId) {
      // بدون داده اولیه، به ابتدای مسیر برمی‌گردانیم
      toast({ title: 'اطلاعات ناقص', description: 'ابتدا آدرس و نوع خدمات را انتخاب کنید.', variant: 'destructive' });
      navigate('/');
    }
    // eslint-disable-next-line
  }, []);

  // expert flow now handled via CarpetExpertPricingDialog (no local toggle mode)
  const [rows, setRows] = useState<Row[]>([]);
  const [pickerValue, setPickerValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  const addRow = (itemId: string) => {
    if (!itemId) return;
    setRows(prev => [
      ...prev,
      {
        rowId: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId,
        quantity: 1,
        length: '',
        width: '',
      },
    ]);
    setPickerValue('');
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.rowId !== id));
  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => (r.rowId === id ? { ...r, ...patch } : r)));

  const rowTotal = (row: Row): { area: number; unit: number; total: number; item: CatalogItem | undefined } => {
    const item = CATALOG.find(c => c.id === row.itemId);
    if (!item) return { area: 0, unit: 0, total: 0, item: undefined };
    if (item.kind === 'fixed') {
      const unit = item.price;
      return { area: 0, unit, total: unit * row.quantity, item };
    }
    const L = parseLocalizedNumber(row.length);
    const W = parseLocalizedNumber(row.width);
    const area = L > 0 && W > 0 ? L * W : 0;
    const unit = area * item.pricePerM2;
    return { area, unit, total: unit * row.quantity, item };
  };

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + rowTotal(r).total, 0),
    [rows, CATALOG],
  );

  const handleSubmit = async () => {
    if (!customerId || !user) {
      toast({ title: 'ورود نشده', description: 'برای ثبت سفارش وارد حساب شوید.', variant: 'destructive' });
      return;
    }
    if (!rows.length) {
      toast({ title: 'آیتمی انتخاب نشده', description: 'حداقل یک آیتم به سفارش اضافه کنید.', variant: 'destructive' });
      return;
    }
    // اعتبارسنجی سطرها
    for (const r of rows) {
      const item = CATALOG.find(c => c.id === r.itemId);
      if (!item) continue;
      if (item.kind === 'per_m2') {
        if (!parseLocalizedNumber(r.length) || !parseLocalizedNumber(r.width)) {
          toast({ title: 'ابعاد ناقص', description: `طول و عرض «${item.label}» را وارد کنید.`, variant: 'destructive' });
          return;
        }
      }
      if (r.quantity < 1) {
        toast({ title: 'تعداد نامعتبر', description: `تعداد «${item.label}» باید حداقل ۱ باشد.`, variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      let finalHierarchyProjectId = projectId || hierarchyProjectId || null;
      if (!finalHierarchyProjectId && locationId && state.serviceTypeId && subcategoryId) {
        finalHierarchyProjectId = await getOrCreateProject(locationId, state.serviceTypeId, subcategoryId);
      }

      if (!finalHierarchyProjectId) {
        throw new Error('شناسه پروژه برای ثبت سفارش پیدا نشد. لطفاً آدرس را دوباره انتخاب کنید.');
      }

      const sanitizedAddress = sanitizeHtml(locationAddress);
      const items = rows.map(r => {
        const { area, unit, total, item } = rowTotal(r);
        return {
          id: r.itemId,
          label: item?.label,
          kind: item?.kind,
          quantity: r.quantity,
          length: r.length ? parseLocalizedNumber(r.length) : null,
          width: r.width ? parseLocalizedNumber(r.width) : null,
          area_m2: area || null,
          unit_price: unit,
          total_price: total,
        };
      });

      const validated = createProjectV3Schema.parse({
        _customer_id: customerId,
        _province_id: provinceId,
        _district_id: districtId || null,
        _subcategory_id: subcategoryId,
        _hierarchy_project_id: finalHierarchyProjectId,
        _address: sanitizedAddress,
        _detailed_address: sanitizedAddress,
        _location_lat: typeof lat === 'number' ? lat : null,
        _location_lng: typeof lng === 'number' ? lng : null,
        _notes: JSON.stringify({
          service_type: 'carpet_cleaning',
          items,
          estimated_price: grandTotal,
          user_notes: notes || undefined,
          customerName: user?.user_metadata?.full_name || '',
          phoneNumber: user?.phone || '',
        }),
      });

      const { data, error } = await supabase.rpc('create_project_v3', validated as any);
      if (error) throw error;
      const created = data?.[0];
      toast({ title: 'ثبت شد', description: 'سفارش قالی شویی با موفقیت ثبت شد.' });

      // ارسال پیامک تایید ثبت سفارش به مشتری و مدیرعامل + نوتیفیکیشن مدیران
      if (created?.code) {
        const customerPhone =
          (created as any)?.customer_phone ||
          (user?.user_metadata as any)?.phone_number ||
          user?.phone ||
          '';
        const customerName =
          (created as any)?.customer_name ||
          (user?.user_metadata as any)?.full_name ||
          'مشتری';
        const smsAddress = buildOrderSmsAddress(locationAddress, locationAddress);

        sendOrderSms(customerPhone, created.code, 'submitted', {
          orderId: created.id,
          serviceType: 'قالی شویی',
          address: smsAddress,
          customerName,
        }).catch(err => console.error('[CarpetCleaningForm] Customer SMS error:', err));

        sendCeoNotificationSms(created.code, 'submitted', {
          orderId: created.id,
          serviceType: 'قالی شویی',
          address: smsAddress,
          customerName,
        }).catch(err => console.error('[CarpetCleaningForm] CEO SMS error:', err));

        notifyManagers({
          order_code: created.code,
          order_id: created.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_user_id: user?.id,
          service_type: 'قالی شویی',
        }).catch(err => console.error('[CarpetCleaningForm] Notify managers error:', err));
      }

      if (created?.id) navigate(`/user/orders/${created.id}`);
      else navigate('/user/orders');
    } catch (e: any) {
      console.error(e);
      toast({ title: 'خطا در ثبت سفارش', description: e?.message || 'خطای نامشخص', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full" dir="rtl">

      <div className="relative z-10 container mx-auto px-4 max-w-7xl py-8">
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 text-white hover:bg-white/10">
            <ArrowRight className="h-4 w-4" /> بازگشت
          </Button>

          <Card className="shadow-2xl bg-card/20 backdrop-blur-md border-2">
            <CardHeader className="text-center border-b">
              <CardTitle className="text-2xl flex items-center justify-center gap-2 text-foreground">
                <Building2 className="h-6 w-6 text-foreground" />
                فرم ثبت سفارش {serviceName}
              </CardTitle>
              <CardDescription>آیتم‌های قالی و موکت خود را اضافه و پیش‌فاکتور را به‌صورت لحظه‌ای مشاهده کنید.</CardDescription>
            </CardHeader>

            {locationAddress && (
              <CardContent className="pt-6 pb-4 border-b bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Alert className="border-primary/30">
                    <MapPin className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">آدرس پروژه:</p>
                        {locationTitle && <p className="text-xs text-muted-foreground">{locationTitle}</p>}
                        <p className="text-sm">{locationAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {provinceName && `${provinceName}`}
                          {districtName && ` • ${districtName}`}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                  <Alert className="border-primary/30">
                    <Package className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">نوع خدمات:</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">خدمات اصلی:</span>
                          <span className="text-sm font-medium">{serviceName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">زیرشاخه:</span>
                          <span className="text-sm">{subcategoryName}</span>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            )}

            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                {/* ---------------- Right column: item builder ---------------- */}
                <div className="space-y-5">
                  {/* Expert pricing request */}
                  <div className="flex flex-wrap items-center gap-3 justify-between rounded-xl border bg-background/60 backdrop-blur-sm p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium">
                        می‌خواهید کارشناس ما قیمت را برایتان محاسبه کند؟
                      </p>
                    </div>
                    <CarpetExpertPricingDialog
                      subcategoryId={subcategoryId}
                      provinceId={provinceId}
                      districtId={districtId}
                      address={locationAddress}
                      detailedAddress={locationAddress}
                      locationLat={lat}
                      locationLng={lng}
                      serviceTypeName={serviceName}
                      hierarchyProjectId={projectId || hierarchyProjectId}
                      locationId={locationId}
                      serviceTypeId={state.serviceTypeId}
                    />
                  </div>

                  {(
                    <>


                      {/* Picker */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Plus className="w-4 h-4 text-primary" />
                            افزودن آیتم جدید
                          </CardTitle>
                          <CardDescription>ابتدا نوع فرش یا موکت خود را انتخاب کنید.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Select value={pickerValue} onValueChange={(v) => setPickerValue(v)}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="یکی از آیتم‌ها را انتخاب کنید" />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="px-2 py-1 text-xs text-muted-foreground">فرش‌ها</div>
                                {CATALOG.filter(i => i.group === 'carpet').map(i => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.label}{' — '}
                                    {i.kind === 'fixed'
                                      ? `${toFa(i.price)} تومان`
                                      : `${toFa(i.pricePerM2)} تومان / متر مربع`}
                                  </SelectItem>
                                ))}
                                <div className="px-2 py-1 mt-1 text-xs text-muted-foreground">موکت‌ها</div>
                                {CATALOG.filter(i => i.group === 'moquette').map(i => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.label} — {toFa((i as any).pricePerM2)} تومان / متر مربع
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button onClick={() => addRow(pickerValue)} disabled={!pickerValue} className="gap-2">
                              <Plus className="w-4 h-4" /> افزودن
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Rows */}
                      <div className="space-y-3">
                        <AnimatePresence initial={false}>
                          {rows.length === 0 && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
                            >
                              هنوز آیتمی اضافه نشده است. با استفاده از کادر بالا، اولین آیتم را اضافه کنید.
                            </motion.div>
                          )}
                          {rows.map(row => {
                            const { area, unit, total, item } = rowTotal(row);
                            if (!item) return null;
                            const needsDims = item.kind === 'per_m2';
                            return (
                              <motion.div
                                key={row.rowId}
                                layout
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="rounded-xl border bg-card p-4 shadow-sm"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                                      {item.icon}
                                    </span>
                                    <div>
                                      <div className="font-semibold text-sm">{item.label}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {item.kind === 'fixed'
                                          ? `قیمت پایه: ${toFa(item.price)} تومان`
                                          : `${toFa(item.pricePerM2)} تومان / متر مربع`}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:bg-destructive/10"
                                    onClick={() => removeRow(row.rowId)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>

                                {needsDims && (
                                  <div className="mt-4 rounded-lg border bg-muted/40 p-3">
                                    <p className="text-xs mb-2 font-medium">ابعاد این آیتم:</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">طول (متر)</Label>
                                        <Input
                                          inputMode="decimal"
                                          dir="ltr"
                                          className="text-left"
                                          placeholder="مثلاً 3"
                                          value={row.length}
                                          onChange={e => updateRow(row.rowId, { length: e.target.value })}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">عرض (متر)</Label>
                                        <Input
                                          inputMode="decimal"
                                          dir="ltr"
                                          className="text-left"
                                          placeholder="مثلاً 2"
                                          value={row.width}
                                          onChange={e => updateRow(row.rowId, { width: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                    {area > 0 && (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        مساحت محاسبه‌شده: <b>{toFa(area.toFixed(2))}</b> متر مربع
                                      </p>
                                    )}
                                  </div>
                                )}

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                  {/* Quantity */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">تعداد:</span>
                                    <div className="inline-flex items-center rounded-lg border overflow-hidden">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-none h-9 w-9"
                                        onClick={() => updateRow(row.rowId, { quantity: Math.max(1, row.quantity - 1) })}
                                      >
                                        <Minus className="w-4 h-4" />
                                      </Button>
                                      <div className="w-10 text-center text-sm font-bold">{toFa(row.quantity)}</div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-none h-9 w-9"
                                        onClick={() => updateRow(row.rowId, { quantity: row.quantity + 1 })}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground ml-1">قیمت این ردیف:</span>
                                    <span className="font-bold text-primary">{toFa(total)} تومان</span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>

                      {/* Notes */}
                      <div className="space-y-2">
                        <Label className="text-sm">توضیحات اضافه (اختیاری)</Label>
                        <Input
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="اگر نکته‌ای دربارهٔ سفارش دارید بنویسید"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* ---------------- Left column: smart invoice ---------------- */}
                <div className="lg:sticky lg:top-6 h-fit">
                  <Card className="shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-primary" />
                        پیش‌فاکتور هوشمند
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">آیتم‌های خود را اضافه کنید تا قیمت نهایی محاسبه شود.</p>
                      ) : (
                        <div className="space-y-2">
                          {rows.map(r => {
                            const { total, item } = rowTotal(r);
                            if (!item) return null;
                            return (
                              <div key={r.rowId} className="flex justify-between text-sm border-b border-dashed pb-1.5">
                                <span className="text-muted-foreground truncate max-w-[60%]">
                                  {item.label} × {toFa(r.quantity)}
                                </span>
                                <span className="font-medium">{toFa(total)}</span>
                              </div>
                            );
                          })}
                          <div className="pt-2 flex justify-between items-baseline">
                            <span className="text-sm">جمع کل:</span>
                            <span className="text-xl font-extrabold text-primary">
                              {toFa(grandTotal)} <span className="text-xs font-normal">تومان</span>
                            </span>
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full mt-3"
                        onClick={handleSubmit}
                        disabled={submitting || rows.length === 0}
                      >

                        {submitting ? 'در حال ثبت…' : 'ثبت نهایی سفارش'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
