import { useEffect, useMemo, useState } from 'react';
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { useCEORole } from '@/hooks/useCEORole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Search, Users, Star, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { rankToDiscountPercent } from '@/lib/cooperationDiscount';
import { toEnglishDigits } from '@/lib/numberParsing';


interface UserRow {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  cooperation_rank: number;
}

export default function UserCooperationRankModule() {
  const { isCEO, loading: roleLoading } = useCEORole();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone_number, cooperation_rank')
      .order('full_name', { ascending: true })
      .limit(1000);
    if (error) {
      toast.error('خطا در بارگذاری: ' + error.message);
    } else {
      const list = (data || []).map((r: any) => ({
        user_id: r.user_id,
        full_name: r.full_name,
        phone_number: r.phone_number,
        cooperation_rank: Number(r.cooperation_rank) || 1,
      }));
      setRows(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isCEO) load();
  }, [isCEO]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.full_name || '').includes(q) ||
        (r.phone_number || '').includes(q)
    );
  }, [rows, search]);

  const handleChange = (userId: string, value: number) => {
    const v = Math.max(1, Math.min(10, Math.round(value || 1)));
    setDraft((p) => ({ ...p, [userId]: v }));
  };

  const handleSave = async (row: UserRow) => {
    const newRank = draft[row.user_id] ?? row.cooperation_rank;
    if (newRank === row.cooperation_rank) return;
    setSavingId(row.user_id);
    const { error } = await supabase
      .from('profiles')
      .update({ cooperation_rank: newRank })
      .eq('user_id', row.user_id);
    setSavingId(null);
    if (error) {
      toast.error('خطا: ' + error.message);
      return;
    }
    toast.success(`رتبه «${row.full_name || row.phone_number}» به ${newRank} تغییر کرد`);
    setRows((prev) =>
      prev.map((r) => (r.user_id === row.user_id ? { ...r, cooperation_rank: newRank } : r))
    );
    setDraft((p) => {
      const { [row.user_id]: _, ...rest } = p;
      return rest;
    });
  };

  if (roleLoading) {
    return (
      <ModuleLayout
        defaultModuleKey="user_cooperation_rank"
        defaultTitle="ماژول رتبه همکاری کاربران"
        defaultDescription="مدیریت رتبه همکاری و تخفیف کاربران"
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  if (!isCEO) {
    return (
      <ModuleLayout
        defaultModuleKey="user_cooperation_rank"
        defaultTitle="ماژول رتبه همکاری کاربران"
        defaultDescription="مدیریت رتبه همکاری و تخفیف کاربران"
      >
        <div className="text-center py-20 text-muted-foreground">
          فقط مدیر ارشد (CEO) به این ماژول دسترسی دارد.
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout
      defaultModuleKey="user_cooperation_rank"
      defaultTitle="ماژول رتبه همکاری کاربران"
      defaultDescription="تعیین رتبه همکاری 1 تا 10 و تخفیف خودکار 1٪ تا 9٪ روی سفارشات"
    >
      <div className="space-y-6" dir="rtl">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="w-5 h-5 text-amber-500" />
              راهنما
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-7">
            رتبه همکاری از <b>1</b> تا <b>10</b> قابل تنظیم است. هرچه رتبه بالاتر باشد، درصد تخفیف
            بیشتری روی سفارش‌های آن کاربر اعمال می‌شود (از <b>۱٪</b> برای رتبه ۱ تا <b>۹٪</b> برای رتبه ۱۰).
            تغییرات بلافاصله روی محاسبه قیمت سفارش‌های جدید این کاربر اعمال می‌شود.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-primary" />
              کاربران ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="جست‌وجو بر اساس نام یا شماره موبایل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">کاربری یافت نشد.</div>
            ) : (
              <div className="divide-y border rounded-lg">
                {filtered.map((row) => {
                  const current = draft[row.user_id] ?? row.cooperation_rank;
                  const isDirty = current !== row.cooperation_rank;
                  const pct = rankToDiscountPercent(current);
                  return (
                    <div
                      key={row.user_id}
                      className={`grid grid-cols-1 md:grid-cols-[1.5fr_1fr_140px_120px_auto] gap-3 items-center p-3 ${
                        isDirty ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium">{row.full_name || 'بدون نام'}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {row.phone_number || '—'}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        رتبه فعلی:{' '}
                        <Badge variant="secondary" className="ml-1">
                          {row.cooperation_rank}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          aria-label="کاهش رتبه"
                          disabled={current <= 1}
                          onClick={() => handleChange(row.user_id, current - 1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={String(current)}
                          onChange={(e) => {
                            const raw = toEnglishDigits(e.target.value).replace(/[^\d]/g, '');
                            if (raw === '') return;
                            handleChange(row.user_id, parseInt(raw, 10));
                          }}
                          dir="ltr"
                          className="text-center h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          aria-label="افزایش رتبه"
                          disabled={current >= 10}
                          onClick={() => handleChange(row.user_id, current + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="text-xs">
                        تخفیف:{' '}
                        <span className="font-bold text-emerald-700">{pct}٪</span>
                      </div>
                      <Button
                        size="sm"
                        disabled={!isDirty || savingId === row.user_id}
                        onClick={() => handleSave(row)}
                      >
                        {savingId === row.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-4 h-4 ml-1" /> ذخیره
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  );
}
