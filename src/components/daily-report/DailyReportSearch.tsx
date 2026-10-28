import { useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { format } from 'date-fns-jalali';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  moduleKey: string;
  isAggregated: boolean;
  onSelectDate: (date: Date) => void;
}

interface ResultRow {
  id: string;
  report_date: string;
  activity_description: string | null;
  team_name: string | null;
  notes: string | null;
  order_id: string | null;
  order?: { code: string | null; customer_name: string | null; address: string | null } | null;
}

const normalize = (s: string) =>
  s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[,()%*\\]/g, ' ')
    .trim();

export function DailyReportSearch({ moduleKey, isAggregated, onSelectDate }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const runSearch = async () => {
    const q = normalize(query);
    if (q.length < 2) {
      toast.error('حداقل ۲ حرف برای جستجو وارد کنید');
      return;
    }
    setLoading(true);
    try {
      const pattern = `%${q}%`;
      const { data: projects } = await supabase
        .from('projects_v3')
        .select('id')
        .or(`customer_name.ilike.${pattern},address.ilike.${pattern},code.ilike.${pattern}`)
        .limit(300);
      const projectIds = (projects || []).map((p: any) => p.id);

      const orParts = [
        `activity_description.ilike.${pattern}`,
        `team_name.ilike.${pattern}`,
        `notes.ilike.${pattern}`,
        `service_details.ilike.${pattern}`,
      ];
      if (projectIds.length) orParts.push(`order_id.in.(${projectIds.join(',')})`);

      let rq: any = supabase
        .from('daily_report_orders')
        .select('id, order_id, activity_description, team_name, notes, daily_reports!inner(report_date, module_key, is_archived)')
        .or(orParts.join(','))
        .limit(300);
      if (!isAggregated) rq = rq.eq('daily_reports.module_key', moduleKey);
      const { data, error } = await rq;
      if (error) throw error;

      const rows: ResultRow[] = (data || [])
        .filter((r: any) => !r.daily_reports?.is_archived)
        .map((r: any) => ({
          id: r.id,
          report_date: r.daily_reports.report_date,
          activity_description: r.activity_description,
          team_name: r.team_name,
          notes: r.notes,
          order_id: r.order_id,
        }));

      const ids = Array.from(new Set(rows.map((r) => r.order_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: orders } = await supabase
          .from('projects_v3')
          .select('id, code, customer_name, address')
          .in('id', ids);
        const map = new Map((orders || []).map((o: any) => [o.id, o]));
        rows.forEach((r) => (r.order = r.order_id ? (map.get(r.order_id) as any) : null));
      }
      rows.sort((a, b) => b.report_date.localeCompare(a.report_date));
      setResults(rows);
    } catch (e: any) {
      console.error('daily report search failed', e);
      toast.error('خطا در جستجو');
    } finally {
      setLoading(false);
    }
  };

  const pick = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    onSelectDate(new Date(y, m - 1, d, 12));
    setResults(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full max-w-xl self-center space-y-2" dir="rtl">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="جستجو در گزارش‌های قبلی: نام کارفرما، آدرس، شرح فعالیت..."
        />
        <Button onClick={runSearch} disabled={loading} className="gap-1 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          جستجو
        </Button>
        {results && (
          <Button variant="ghost" size="icon" onClick={() => setResults(null)} aria-label="بستن نتایج">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {results && (
        <div className="max-h-80 overflow-y-auto rounded-md border bg-card divide-y">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground text-center">نتیجه‌ای پیدا نشد</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pick(r.report_date)}
                className="w-full text-right p-3 hover:bg-accent transition-colors space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary text-sm">
                    {format(new Date(r.report_date + 'T12:00:00'), 'EEEE yyyy/MM/dd')}
                  </span>
                  {r.order && (
                    <span className="text-xs text-muted-foreground">
                      {r.order.code} - {r.order.customer_name}
                    </span>
                  )}
                </div>
                {r.order?.address && <p className="text-xs text-muted-foreground">آدرس: {r.order.address}</p>}
                {r.activity_description && <p className="text-sm">{r.activity_description}</p>}
                {r.team_name && <p className="text-xs text-muted-foreground">اکیپ: {r.team_name}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
