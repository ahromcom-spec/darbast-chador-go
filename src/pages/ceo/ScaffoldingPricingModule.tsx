import { useEffect, useMemo, useState } from 'react';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { useScaffoldingPricing, PricingItem } from '@/hooks/useScaffoldingPricing';
import { supabase } from '@/integrations/supabase/client';
import { useCEORole } from '@/hooks/useCEORole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, RefreshCw, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseLocalizedNumber } from '@/lib/numberParsing';
import { useScaffoldingPricingConditions } from '@/hooks/useScaffoldingPricingConditions';
import { CategoryConditionsBox, CategoryConditionsList } from '@/components/pricing/CategoryConditionsBox';
import { CategoryRulesBuilder } from '@/components/pricing/CategoryRulesBuilder';
import { useScaffoldingPricingRules } from '@/hooks/useScaffoldingPricingRules';

const CATEGORY_LABELS: Record<string, string> = {
  facade: 'داربست سطحی نما',
  formwork: 'کفراژ',
  ceiling_beam: 'زیر بتن تیرچه (یونولیت/سفال)',
  ceiling_slab: 'زیر بتن دال و وافل',
  pipe_length: 'داربست به طول لوله مصرفی',
  column: 'داربست ستونی، نورگیر و چاله آسانسور',
  distance: 'افزایش قیمت به ازای فاصله از مرکز شهر',
  platform_height: 'افزایش قیمت ارتفاع پای کار',
  scaffold_height: 'افزایش قیمت ارتفاع داربست',
  vehicle_distance: 'افزایش قیمت فاصله خودرو تا محل اجرا',
  rental_discount: 'تخفیف اجاره چند ماهه',
  extra_month: 'ضریب ماه‌های اضافی',
};

const CATEGORY_ORDER = [
  'facade',
  'formwork',
  'ceiling_beam',
  'ceiling_slab',
  'pipe_length',
  'column',
  'distance',
  'platform_height',
  'scaffold_height',
  'vehicle_distance',
  'rental_discount',
  'extra_month',
];

export default function ScaffoldingPricingModule() {
  const { isCEO, loading: roleLoading } = useCEORole();
  const { items, isLoading, refetch } = useScaffoldingPricing();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { map: conditionsMap, saveCondition } = useScaffoldingPricingConditions('scaffolding_pricing_config');
  const { byCategory, createRule, updateRule, deleteRule } = useScaffoldingPricingRules('scaffolding_pricing_config');

  useEffect(() => {
    // sync draft with loaded items
    const next: Record<string, string> = {};
    items.forEach((it) => {
      if (!(it.id in draft)) next[it.id] = String(it.value);
    });
    if (Object.keys(next).length) {
      setDraft((prev) => ({ ...next, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const grouped = useMemo(() => {
    const m: Record<string, PricingItem[]> = {};
    items.forEach((it) => {
      (m[it.category] = m[it.category] || []).push(it);
    });
    return m;
  }, [items]);

  const dirtyIds = useMemo(() => {
    return items.filter((it) => {
      const v = draft[it.id];
      if (v === undefined) return false;
      return parseLocalizedNumber(v) !== Number(it.value);
    }).map((it) => it.id);
  }, [items, draft]);

  const handleSave = async () => {
    if (!dirtyIds.length) {
      toast.info('تغییری برای ذخیره وجود ندارد');
      return;
    }
    setSaving(true);
    try {
      for (const id of dirtyIds) {
        const newVal = parseLocalizedNumber(draft[id]);
        const { error } = await supabase
          .from('scaffolding_pricing_config')
          .update({ value: newVal })
          .eq('id', id);
        if (error) throw error;
      }
      toast.success(`${dirtyIds.length} مورد با موفقیت ذخیره شد`);
      await refetch();
    } catch (e: any) {
      toast.error('خطا در ذخیره: ' + (e?.message || 'نامشخص'));
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading || isLoading) {
    return (
      <ModuleLayout defaultModuleKey="scaffolding_pricing" defaultTitle="ماژول قیمت‌گذاری داربست" defaultDescription="مدیریت آیتم‌های قیمت فرم اجرای داربست">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  if (!isCEO) {
    return (
      <ModuleLayout defaultModuleKey="scaffolding_pricing" defaultTitle="ماژول قیمت‌گذاری داربست" defaultDescription="مدیریت آیتم‌های قیمت فرم اجرای داربست">
        <div className="text-center py-20 text-muted-foreground">
          فقط مدیر ارشد (CEO) به این ماژول دسترسی دارد.
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout defaultModuleKey="scaffolding_pricing" defaultTitle="ماژول قیمت‌گذاری اجرای داربست به همراه اجناس و حمل و نقل" defaultDescription="مدیریت آیتم‌های قیمت‌گذاری فرم سفارش داربست فلزی">
      <div className="space-y-6" dir="rtl">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-5 h-5 text-primary" />
              راهنما
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-7">
            این آیتم‌ها مستقیماً در فرم «ثبت سفارش داربست فلزی – اجرای داربست به همراه اجناس و حمل و نقل»
            برای محاسبه قیمت استفاده می‌شوند. هر مقداری که اینجا تغییر دهید، بلافاصله روی قیمت سفارش‌های جدید اعمال می‌شود.
            مقادیر «درصد» به عنوان درصد افزایش/تخفیف قیمت پایه عمل می‌کنند.
          </CardContent>
        </Card>

        <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 border-b">
          <div className="text-sm">
            {dirtyIds.length > 0 ? (
              <span className="text-orange-600 font-bold">{dirtyIds.length} تغییر ذخیره نشده</span>
            ) : (
              <span className="text-muted-foreground">بدون تغییر</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={saving}>
              <RefreshCw className="w-4 h-4 ml-2" /> بارگذاری مجدد
            </Button>
            <Button onClick={handleSave} disabled={saving || !dirtyIds.length}>
              {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
              ذخیره تغییرات
            </Button>
          </div>
        </div>

        {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="text-base">{CATEGORY_LABELS[cat] || cat}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CategoryRulesBuilder
                category={cat}
                categoryLabel={CATEGORY_LABELS[cat] || cat}
                rules={byCategory(cat)}
                onCreate={createRule}
                onUpdate={updateRule}
                onDelete={deleteRule}
              />
              <CategoryConditionsList
                category={cat}
                categoryLabel={CATEGORY_LABELS[cat] || cat}
                value={conditionsMap[cat] || ''}
                onSave={saveCondition}
              />
              {grouped[cat].map((item) => {
                const current = draft[item.id] ?? String(item.value);
                const isDirty = dirtyIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-1 md:grid-cols-[1fr_220px_120px] gap-3 items-center p-3 rounded-lg border ${
                      isDirty ? 'border-orange-400 bg-orange-50/40' : 'border-border'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                      )}
                    </div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={(() => {
                        if (current === '') return '';
                        if (/[.,٫]/.test(current)) return current;
                        const n = parseLocalizedNumber(current);
                        if (isNaN(n)) return current;
                        return n.toLocaleString('en-US');
                      })()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, '');
                        setDraft((prev) => ({ ...prev, [item.id]: raw }));
                      }}
                      dir="ltr"
                      className="text-left"
                    />
                    <div className="text-xs text-muted-foreground">{item.unit}</div>
                  </div>
                );
              })}
              <CategoryConditionsBox
                category={cat}
                categoryLabel={CATEGORY_LABELS[cat] || cat}
                value={conditionsMap[cat] || ''}
                onSave={saveCondition}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </ModuleLayout>
  );
}
