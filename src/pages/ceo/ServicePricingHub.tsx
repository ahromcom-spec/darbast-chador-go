import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { supabase } from '@/integrations/supabase/client';
import { useCEORole } from '@/hooks/useCEORole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Settings2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';

interface SubcategoryRow {
  id: string;
  name: string;
  code: string;
  service_type_id: string;
  is_active: boolean;
  is_service_active: boolean;
  service_types_v3?: { id: string; name: string; code: string } | null;
}

const MODULE_TITLE = 'ماژول‌های قیمت‌گذاری خدمات';
const MODULE_DESC = 'مدیریت وضعیت فعال/غیرفعال و قیمت‌گذاری هر یک از زیرشاخه‌های خدمات';

export default function ServicePricingHub() {
  const navigate = useNavigate();
  const { isCEO, loading: roleLoading } = useCEORole();
  const [rows, setRows] = useState<SubcategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subcategories')
      .select('id, name, code, service_type_id, is_active, is_service_active, service_types_v3:service_types_v3!subcategories_service_type_id_fkey(id, name, code)')
      .eq('is_active', true)
      .order('service_type_id')
      .order('code');
    if (error) toast.error('خطا در بارگذاری: ' + error.message);
    setRows(((data || []) as unknown) as SubcategoryRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel('subcategories-active-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'subcategories' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return rows;
    return rows.filter(r =>
      r.name.includes(s) ||
      r.code.includes(s) ||
      (r.service_types_v3?.name || '').includes(s)
    );
  }, [q, rows]);

  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; items: SubcategoryRow[] }>();
    filtered.forEach(r => {
      const key = r.service_type_id;
      const bucket = m.get(key) || { name: r.service_types_v3?.name || 'بدون گروه', items: [] };
      bucket.items.push(r);
      m.set(key, bucket);
    });
    return Array.from(m.values());
  }, [filtered]);

  const toggleActive = async (row: SubcategoryRow, next: boolean) => {
    setTogglingId(row.id);
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_service_active: next } : r));
    const { error } = await supabase
      .from('subcategories')
      .update({ is_service_active: next } as any)
      .eq('id', row.id);
    setTogglingId(null);
    if (error) {
      toast.error('عدم موفقیت در بروزرسانی: ' + error.message);
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_service_active: !next } : r));
      return;
    }
    toast.success(next ? 'خدمت فعال شد' : 'خدمت غیرفعال شد — به مشتریان پیام «فرم هنوز جایگزاری نشده» نمایش داده می‌شود');
  };

  if (roleLoading || loading) {
    return (
      <ModuleLayout defaultModuleKey="service_pricing_hub" defaultTitle={MODULE_TITLE} defaultDescription={MODULE_DESC}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
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

  return (
    <ModuleLayout defaultModuleKey="service_pricing_hub" defaultTitle={MODULE_TITLE} defaultDescription={MODULE_DESC}>
      <div className="space-y-6" dir="rtl">
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              راهنما
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-7">
            برای هر «زیرشاخه خدمات» یک ماژول قیمت‌گذاری مستقل ایجاد شده است. با کلید سبز/قرمز
            می‌توانید یک خدمت را برای مشتریان فعال یا غیرفعال کنید. وقتی یک خدمت غیرفعال باشد،
            مشتری در انتخاب آن خدمت به‌جای فرم ثبت سفارش، کادر «فرم خدمات هنوز جایگزاری نشده است»
            را می‌بیند تا با شفافیت پیگیری کند. با دکمهٔ «ورود» می‌توانید قیمت‌های اختصاصی آن خدمت
            را ثبت و ویرایش کنید.
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 sticky top-0 z-10 bg-background py-3 border-b">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو بر اساس نام خدمت، کد یا گروه..." className="pr-9" />
          </div>
        </div>

        {grouped.map(group => (
          <Card key={group.name}>
            <CardHeader>
              <CardTitle className="text-base">{group.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.items.map(row => (
                <div key={row.id}
                  className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border transition ${
                    row.is_service_active ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'
                  }`}>
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">کد: {row.code}</div>
                  </div>
                  <Badge variant={row.is_service_active ? 'default' : 'destructive'} className="gap-1">
                    {row.is_service_active ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                    {row.is_service_active ? 'فعال' : 'غیرفعال'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">فعال برای مشتریان</span>
                    <Switch
                      checked={row.is_service_active}
                      disabled={togglingId === row.id}
                      onCheckedChange={(v) => toggleActive(row, v)}
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/service-pricing/${row.id}`)}>
                    ورود به ماژول قیمت‌گذاری
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {!grouped.length && (
          <div className="text-center py-10 text-muted-foreground">موردی یافت نشد.</div>
        )}
      </div>
    </ModuleLayout>
  );
}
