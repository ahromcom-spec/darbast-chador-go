import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { supabase } from '@/integrations/supabase/client';
import { useCEORole } from '@/hooks/useCEORole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Save, Trash2, ArrowRight, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { parseLocalizedNumber } from '@/lib/numberParsing';

interface PricingItem {
  id: string;
  subcategory_id: string;
  key: string;
  category: string;
  label: string;
  value: number;
  unit: string;
  description: string | null;
  sort_order: number;
  _dirty?: boolean;
  _isNew?: boolean;
}

interface SubcategoryInfo {
  id: string;
  name: string;
  code: string;
  is_service_active: boolean;
  service_types_v3?: { name: string } | null;
}

const MODULE_TITLE = 'ماژول قیمت‌گذاری خدمت';
const MODULE_DESC = 'مدیریت وضعیت فعال بودن و آیتم‌های قیمت این خدمت';

export default function ServicePricingEditor() {
  const { subcategoryId } = useParams<{ subcategoryId: string }>();
  const navigate = useNavigate();
  const { isCEO, loading: roleLoading } = useCEORole();
  const [info, setInfo] = useState<SubcategoryInfo | null>(null);
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    if (!subcategoryId) return;
    setLoading(true);
    const [{ data: sub, error: e1 }, { data: pr, error: e2 }] = await Promise.all([
      supabase
        .from('subcategories')
        .select('id, name, code, is_service_active, service_types_v3:service_types_v3!subcategories_service_type_id_fkey(name)')
        .eq('id', subcategoryId)
        .maybeSingle(),
      supabase
        .from('subcategory_pricing_items' as any)
        .select('*')
        .eq('subcategory_id', subcategoryId)
        .order('sort_order', { ascending: true }),
    ]);
    if (e1) toast.error('خطا در بارگذاری خدمت: ' + e1.message);
    if (e2) toast.error('خطا در بارگذاری آیتم‌ها: ' + e2.message);
    setInfo((sub as unknown) as SubcategoryInfo);
    setItems(((pr || []) as unknown) as PricingItem[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [subcategoryId]);

  const dirtyCount = useMemo(() => items.filter(i => i._dirty || i._isNew).length, [items]);

  const updateItem = (id: string, patch: Partial<PricingItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch, _dirty: true } : i));
  };

  const addItem = () => {
    const tempId = 'new_' + Math.random().toString(36).slice(2, 9);
    setItems(prev => [
      ...prev,
      {
        id: tempId,
        subcategory_id: subcategoryId!,
        key: `item_${prev.length + 1}`,
        category: 'general',
        label: 'آیتم جدید',
        value: 0,
        unit: 'تومان',
        description: '',
        sort_order: prev.length,
        _isNew: true,
        _dirty: true,
      },
    ]);
  };

  const removeItem = async (item: PricingItem) => {
    if (!confirm(`حذف «${item.label}»؟`)) return;
    if (item._isNew) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      return;
    }
    const { error } = await supabase.from('subcategory_pricing_items' as any).delete().eq('id', item.id);
    if (error) return toast.error('خطا در حذف: ' + error.message);
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast.success('حذف شد');
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const toInsert = items.filter(i => i._isNew).map(({ id, _dirty, _isNew, ...rest }) => ({
        ...rest,
        value: Number(rest.value) || 0,
      }));
      const toUpdate = items.filter(i => i._dirty && !i._isNew);

      if (toInsert.length) {
        const { error } = await supabase.from('subcategory_pricing_items' as any).insert(toInsert);
        if (error) throw error;
      }
      for (const it of toUpdate) {
        const { error } = await supabase
          .from('subcategory_pricing_items' as any)
          .update({
            key: it.key,
            category: it.category,
            label: it.label,
            value: Number(it.value) || 0,
            unit: it.unit,
            description: it.description,
            sort_order: it.sort_order,
          })
          .eq('id', it.id);
        if (error) throw error;
      }
      toast.success('ذخیره شد');
      await load();
    } catch (e: any) {
      toast.error('خطا در ذخیره: ' + (e?.message || 'نامشخص'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (next: boolean) => {
    if (!info) return;
    setToggling(true);
    setInfo({ ...info, is_service_active: next });
    const { error } = await supabase
      .from('subcategories')
      .update({ is_service_active: next } as any)
      .eq('id', info.id);
    setToggling(false);
    if (error) {
      setInfo({ ...info, is_service_active: !next });
      return toast.error('خطا: ' + error.message);
    }
    toast.success(next ? 'خدمت برای مشتریان فعال شد' : 'خدمت غیرفعال شد — مشتریان کادر «فرم هنوز جایگزاری نشده» را می‌بینند');
  };

  if (roleLoading || loading) {
    return (
      <ModuleLayout defaultModuleKey="service_pricing_hub" defaultTitle={MODULE_TITLE} defaultDescription={MODULE_DESC}>
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </ModuleLayout>
    );
  }

  if (!isCEO) {
    return (
      <ModuleLayout defaultModuleKey="service_pricing_hub" defaultTitle={MODULE_TITLE} defaultDescription={MODULE_DESC}>
        <div className="text-center py-20 text-muted-foreground">فقط مدیر ارشد (CEO) به این ماژول دسترسی دارد.</div>
      </ModuleLayout>
    );
  }

  if (!info) {
    return (
      <ModuleLayout defaultModuleKey="service_pricing_hub" defaultTitle={MODULE_TITLE} defaultDescription={MODULE_DESC}>
        <div className="text-center py-20 text-muted-foreground">خدمت یافت نشد.</div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout defaultModuleKey="service_pricing_hub" defaultTitle={`${MODULE_TITLE} — ${info.name}`} defaultDescription={MODULE_DESC}>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/service-pricing')} className="gap-2">
            <ArrowRight className="w-4 h-4" /> بازگشت به لیست خدمات
          </Button>
        </div>

        {/* Toggle at top */}
        <Card className={info.is_service_active ? 'border-emerald-300' : 'border-red-300'}>
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <div className="text-sm text-muted-foreground">{info.service_types_v3?.name} • کد {info.code}</div>
              <div className="text-lg font-bold">{info.name}</div>
            </div>
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${
              info.is_service_active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700'
            }`}>
              {info.is_service_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              <span className="font-bold">{info.is_service_active ? 'خدمت فعال' : 'خدمت غیرفعال'}</span>
              <Switch checked={info.is_service_active} disabled={toggling} onCheckedChange={toggleActive} />
            </div>
          </CardContent>
        </Card>

        {!info.is_service_active && (
          <Card className="border-amber-300 bg-amber-50/50">
            <CardContent className="p-4 text-sm text-amber-800">
              این خدمت هم‌اکنون <b>غیرفعال</b> است. مشتریان هنگام انتخاب این خدمت، به‌جای فرم ثبت سفارش،
              کادر «فرم خدمات هنوز جایگزاری نشده است» را می‌بینند تا با تیم پشتیبانی در ارتباط باشند.
            </CardContent>
          </Card>
        )}

        {/* Pricing items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">آیتم‌های قیمت</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 ml-1" /> افزودن آیتم</Button>
              <Button size="sm" onClick={saveAll} disabled={saving || !dirtyCount}>
                {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
                ذخیره {dirtyCount ? `(${dirtyCount})` : ''}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!items.length && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                هنوز آیتمی تعریف نشده. با دکمهٔ «افزودن آیتم» شروع کنید.
              </div>
            )}
            {items.map(item => (
              <div key={item.id}
                className={`grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_0.7fr_0.8fr_40px] gap-2 p-3 rounded-lg border ${
                  (item._dirty || item._isNew) ? 'border-orange-400 bg-orange-50/40' : 'border-border'
                }`}>
                <Input value={item.label} onChange={e => updateItem(item.id, { label: e.target.value })} placeholder="عنوان" />
                <Input value={item.key} onChange={e => updateItem(item.id, { key: e.target.value })} placeholder="کلید (انگلیسی)" dir="ltr" />
                <Input value={item.category} onChange={e => updateItem(item.id, { category: e.target.value })} placeholder="دسته" />
                <Input
                  value={String(item.value)}
                  onChange={e => {
                    const n = parseLocalizedNumber(e.target.value.replace(/,/g, ''));
                    updateItem(item.id, { value: isNaN(n) ? 0 : n });
                  }}
                  placeholder="مقدار"
                  dir="ltr"
                  className="text-left"
                />
                <Input value={item.unit} onChange={e => updateItem(item.id, { unit: e.target.value })} placeholder="واحد" />
                <Button size="icon" variant="ghost" onClick={() => removeItem(item)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
}
