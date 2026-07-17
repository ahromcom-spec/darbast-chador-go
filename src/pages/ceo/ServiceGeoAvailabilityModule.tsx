import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useServiceTypesWithSubcategories } from '@/hooks/useServiceTypesWithSubcategories';
import { useProvinces } from '@/hooks/useProvinces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  ArrowRight, MapPin, Layers, Plus, Trash2, Search, Globe, Building2, Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

// Persian numerals helper
const toFa = (n: number | string) =>
  String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

interface District { id: string; name: string; province_id: string; }

interface GeoRule {
  id: string;
  service_type_id: string;
  subcategory_id: string | null;
  province_id: string;
  district_id: string | null;
  is_active: boolean;
  created_at: string;
}

const ALL = '__ALL__';

export default function ServiceGeoAvailabilityModule() {
  const navigate = useNavigate();
  const { serviceTypes, loading: loadingServices } = useServiceTypesWithSubcategories();
  const { provinces, loading: loadingProvinces } = useProvinces();

  const [serviceTypeId, setServiceTypeId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>(ALL);
  const [provinceId, setProvinceId] = useState<string>('');
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<GeoRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // Load districts when province changes
  useEffect(() => {
    if (!provinceId) { setDistricts([]); setSelectedDistrictIds([]); return; }
    setLoadingDistricts(true);
    supabase
      .from('districts')
      .select('id, name, province_id')
      .eq('province_id', provinceId)
      .order('name')
      .then(({ data, error }) => {
        if (error) toast.error('خطا در بارگذاری شهرها');
        setDistricts((data as District[]) || []);
        setSelectedDistrictIds([]);
        setLoadingDistricts(false);
      });
  }, [provinceId]);

  // Load rules with realtime
  const loadRules = async () => {
    setLoadingRules(true);
    const { data, error } = await supabase
      .from('service_geo_availability')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('خطا در بارگذاری قوانین');
    setRules((data as GeoRule[]) || []);
    setLoadingRules(false);
  };
  useEffect(() => {
    loadRules();
    const ch = supabase
      .channel('service_geo_availability_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_geo_availability' }, loadRules)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const subcategories = useMemo(
    () => serviceTypes.find((s) => s.id === serviceTypeId)?.subcategories ?? [],
    [serviceTypes, serviceTypeId]
  );

  const filteredDistricts = useMemo(() => {
    const q = districtSearch.trim();
    if (!q) return districts;
    return districts.filter((d) => d.name.includes(q));
  }, [districts, districtSearch]);

  const canSave =
    !!serviceTypeId && !!provinceId && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      // If no districts selected → single rule for whole province (district_id = NULL)
      const rows = selectedDistrictIds.length === 0
        ? [{
            service_type_id: serviceTypeId,
            subcategory_id: subcategoryId === ALL ? null : subcategoryId,
            province_id: provinceId,
            district_id: null,
            is_active: true,
            created_by: uid,
          }]
        : selectedDistrictIds.map((did) => ({
            service_type_id: serviceTypeId,
            subcategory_id: subcategoryId === ALL ? null : subcategoryId,
            province_id: provinceId,
            district_id: did,
            is_active: true,
            created_by: uid,
          }));

      const { error } = await supabase.from('service_geo_availability').insert(rows);
      if (error) throw error;

      toast.success(`${toFa(rows.length)} قانون با موفقیت ذخیره شد`);
      setSelectedDistrictIds([]);
      loadRules();
    } catch (e: any) {
      console.error('geo_availability save error:', e);
      const msg = e?.message || '';
      if (msg.includes('duplicate') || e?.code === '23505') {
        toast.error('این قانون قبلاً ثبت شده است');
      } else if (msg.includes('row-level security') || e?.code === '42501') {
        toast.error('شما دسترسی ثبت این قانون را ندارید (فقط مدیرعامل/مدیر کل)');
      } else {
        toast.error(`خطا در ذخیره قانون: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: GeoRule) => {
    const { error } = await supabase
      .from('service_geo_availability')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    if (error) toast.error('خطا در تغییر وضعیت');
    else {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !rule.is_active } : r));
      toast.success(!rule.is_active ? 'خدمت فعال شد' : 'خدمت غیرفعال شد');
    }
  };

  const deleteRule = async (rule: GeoRule) => {
    if (!confirm('حذف این قانون؟')) return;
    const { error } = await supabase.from('service_geo_availability').delete().eq('id', rule.id);
    if (error) toast.error('خطا در حذف');
    else {
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success('قانون حذف شد');
    }
  };

  // Lookup maps for the rules table
  const serviceTypeMap = useMemo(() => Object.fromEntries(serviceTypes.map((s) => [s.id, s])), [serviceTypes]);
  const subMap = useMemo(() => {
    const m: Record<string, { name: string }> = {};
    serviceTypes.forEach((s) => (s.subcategories || []).forEach((sub) => { m[sub.id] = { name: sub.name }; }));
    return m;
  }, [serviceTypes]);
  const provinceMap = useMemo(() => Object.fromEntries(provinces.map((p) => [p.id, p])), [provinces]);

  // District names for all rules (fetch lazily)
  const [districtNameMap, setDistrictNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const needed = rules.map((r) => r.district_id).filter((x): x is string => !!x && !districtNameMap[x]);
    if (needed.length === 0) return;
    supabase.from('districts').select('id, name').in('id', needed).then(({ data }) => {
      if (data) {
        setDistrictNameMap((prev) => {
          const next = { ...prev };
          data.forEach((d: any) => { next[d.id] = d.name; });
          return next;
        });
      }
    });
  }, [rules]);

  const selectedDistrictsSummary =
    selectedDistrictIds.length === 0
      ? 'همه شهرهای استان'
      : `${toFa(selectedDistrictIds.length)} شهر انتخاب شد`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowRight className="w-4 h-4" />
          بازگشت
        </Button>

        <PageHeader
          title="مدیریت خدمات طبق شهرها"
          description="تعیین کنید هر خدمت در کدام استان‌ها و شهرها فعال باشد. سفارش‌گیری خارج از این محدوده مسدود می‌شود."
        />

        {/* Rule Builder */}
        <Card className="shadow-lg border-2">
          <CardHeader className="bg-gradient-to-l from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>ثبت قانون جدید</CardTitle>
                <CardDescription>خدمت مورد نظر و محدوده جغرافیایی را انتخاب کنید</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Service type */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  گروه خدمات *
                </Label>
                <Select
                  value={serviceTypeId}
                  onValueChange={(v) => { setServiceTypeId(v); setSubcategoryId(ALL); }}
                  disabled={loadingServices}
                >
                  <SelectTrigger><SelectValue placeholder="انتخاب گروه خدمات" /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategory */}
              <div className="space-y-2">
                <Label>زیرشاخه</Label>
                <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!serviceTypeId}>
                  <SelectTrigger><SelectValue placeholder="انتخاب زیرشاخه" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>همه زیرشاخه‌ها</SelectItem>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Province */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-primary" />
                  استان *
                </Label>
                <Select value={provinceId} onValueChange={setProvinceId} disabled={loadingProvinces}>
                  <SelectTrigger><SelectValue placeholder="انتخاب استان" /></SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Districts multi-select */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  شهرها (اختیاری)
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      disabled={!provinceId || loadingDistricts}
                    >
                      <span className="truncate">{loadingDistricts ? 'در حال بارگذاری...' : selectedDistrictsSummary}</span>
                      <Building2 className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          className="w-full h-9 pr-8 pl-2 rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="جستجوی شهر..."
                          value={districtSearch}
                          onChange={(e) => setDistrictSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-auto p-1">
                      {filteredDistricts.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground text-center">شهری یافت نشد</div>
                      )}
                      {filteredDistricts.map((d) => {
                        const checked = selectedDistrictIds.includes(d.id);
                        return (
                          <label
                            key={d.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelectedDistrictIds((prev) =>
                                  v ? [...prev, d.id] : prev.filter((x) => x !== d.id)
                                );
                              }}
                            />
                            <span>{d.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="p-2 border-t flex items-center justify-between text-xs">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setSelectedDistrictIds(districts.map((d) => d.id))}
                      >انتخاب همه</button>
                      <button
                        className="text-muted-foreground hover:underline"
                        onClick={() => setSelectedDistrictIds([])}
                      >پاک کردن</button>
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  اگر شهری انتخاب نکنید، خدمت برای «تمام شهرهای استان» فعال می‌شود.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button onClick={handleSave} disabled={!canSave} size="lg" className="gap-2 min-w-[200px]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                ثبت محدوده خدمت
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rules Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>قوانین جغرافیایی فعال</CardTitle>
                  <CardDescription>مجموع {toFa(rules.length)} قانون ثبت شده</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">گروه خدمات</TableHead>
                      <TableHead className="text-right">زیرشاخه</TableHead>
                      <TableHead className="text-right">استان</TableHead>
                      <TableHead className="text-right">شهر</TableHead>
                      <TableHead className="text-center">وضعیت</TableHead>
                      <TableHead className="text-center w-16">حذف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRules && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin inline" />
                        </TableCell>
                      </TableRow>
                    )}
                    {!loadingRules && rules.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          هنوز قانونی ثبت نشده است.
                        </TableCell>
                      </TableRow>
                    )}
                    {rules.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">
                          {serviceTypeMap[r.service_type_id]?.name || '—'}
                        </TableCell>
                        <TableCell>
                          {r.subcategory_id
                            ? (subMap[r.subcategory_id]?.name || '—')
                            : <Badge variant="secondary">همه زیرشاخه‌ها</Badge>}
                        </TableCell>
                        <TableCell>{provinceMap[r.province_id]?.name || '—'}</TableCell>
                        <TableCell>
                          {r.district_id
                            ? (districtNameMap[r.district_id] || '...')
                            : <Badge variant="outline">همه شهرهای استان</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch checked={r.is_active} onCheckedChange={() => toggleRule(r)} />
                            <span className={`text-xs font-medium ${r.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                              {r.is_active ? 'فعال' : 'غیرفعال'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => deleteRule(r)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
