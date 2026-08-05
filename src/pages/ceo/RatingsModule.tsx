import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Star, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatPersianDate } from '@/lib/dateUtils';

interface RatingRow {
  id: string;
  order_id: string;
  contractor_score: number | null;
  contractor_comment: string | null;
  contractor_target_label: string;
  management_score: number | null;
  management_comment: string | null;
  management_target_label: string;
  created_at: string;
  updated_at: string;
  order_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}

const Stars = ({ score }: { score: number | null }) => (
  <div className="flex items-center gap-0.5" dir="ltr">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`h-4 w-4 ${
          score && n <= score ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'
        }`}
      />
    ))}
    <span className="ms-1 text-xs font-bold">{score ? `${score}/5` : '—'}</span>
  </div>
);

export default function RatingsModule() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('order_ratings')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading order ratings:', error);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (data || []) as RatingRow[];
    const orderIds = [...new Set(list.map((r) => r.order_id))];

    let ordersMap: Record<string, any> = {};
    if (orderIds.length) {
      const { data: orders } = await supabase
        .from('projects_v3')
        .select('id, code, customer_name, customer_phone')
        .in('id', orderIds);
      (orders || []).forEach((o: any) => {
        ordersMap[o.id] = o;
      });
    }

    setRows(
      list.map((r) => ({
        ...r,
        order_code: ordersMap[r.order_id]?.code ?? null,
        customer_name: ordersMap[r.order_id]?.customer_name ?? null,
        customer_phone: ordersMap[r.order_id]?.customer_phone ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.order_code, r.customer_name, r.customer_phone, r.contractor_target_label]
        .filter(Boolean)
        .some((v) => String(v).includes(q))
    );
  }, [rows, search]);

  const avg = (key: 'contractor_score' | 'management_score') => {
    const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
    if (!vals.length) return '—';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="px-4 py-2 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/profile?tab=modules')} className="gap-2">
            بازگشت
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-primary">ماژول مدیریت امتیازدهی</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">تعداد امتیازهای ثبت‌شده</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">میانگین عملکرد پیمانکار و اجرایی</p>
              <p className="text-2xl font-bold text-yellow-600">{avg('contractor_score')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">میانگین مدیریت، پیگیری و زمان‌بندی</p>
              <p className="text-2xl font-bold text-yellow-600">{avg('management_score')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو با شماره سفارش، نام مشتری یا پیمانکار"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            بروزرسانی
          </Button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              هنوز امتیازی ثبت نشده است.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    <span>سفارش {r.order_code || '—'}</span>
                    <Badge variant="outline">{r.customer_name || 'مشتری'}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatPersianDate(r.updated_at, { showDayOfWeek: true })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">عملکرد پیمانکار و اجرایی</span>
                      <Badge variant="secondary" className="text-xs">
                        {r.contractor_target_label}
                      </Badge>
                    </div>
                    <Stars score={r.contractor_score} />
                    {r.contractor_comment && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {r.contractor_comment}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">مدیریت، پیگیری و زمان‌بندی سفارش</span>
                      <Badge variant="secondary" className="text-xs">
                        {r.management_target_label}
                      </Badge>
                    </div>
                    <Stars score={r.management_score} />
                    {r.management_comment && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {r.management_comment}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
