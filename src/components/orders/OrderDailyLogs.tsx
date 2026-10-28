import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Users, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

interface DailyLog {
  id: string;
  order_id: string;
  report_date: string;
  activity_description: string | null;
  team_name: string | null;
  notes: string | null;
}

interface OrderDailyLogsProps {
  orderId: string;
}

export function OrderDailyLogs({ orderId }: OrderDailyLogsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data: logs = [], isLoading: loading, error, refetch } = useQuery<DailyLog[]>({
    queryKey: ['order-report-activity', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_order_report_activity', { p_order_id: orderId });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const channel = supabase.channel(`order-report-activity-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_report_orders', filter: `order_id=eq.${orderId}` }, () => { void refetch(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orderId, refetch]);

  if (loading) {
    return (
      <section className="py-6 flex justify-center" aria-label="شرح فعالیت‌های سفارش">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </section>
    );
  }

  if (error) return <section className="py-4 space-y-2"><p className="text-sm text-destructive">گزارش‌های سفارش بارگذاری نشد.</p><Button variant="outline" onClick={() => { void refetch(); }}>تلاش مجدد</Button></section>;

  if (logs.length === 0) {
    return null; // اگر گزارشی نیست نمایش نده
  }

  return (
    <section className="border-t border-border py-4" aria-label="شرح فعالیت‌های سفارش" dir="rtl">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full h-auto justify-between gap-3 py-3 text-foreground">
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5" />
                <span className="whitespace-normal text-right">شرح فعالیت‌ها و پیام‌های گزارش ({logs.length.toLocaleString('fa-IR')})</span>
              </span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 pt-3">
            {logs.map((log) => (
                <article key={log.id} className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
                  {/* تاریخ */}
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatPersianDate(log.report_date)}
                    </Badge>
                  </div>

                  {/* شرح فعالیت */}
                  {log.activity_description && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">شرح فعالیت:</p>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {log.activity_description}
                      </p>
                    </div>
                  )}

                  {/* اکیپ */}
                  {log.team_name && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">اکیپ:</span>
                      <span className="text-sm font-medium">{log.team_name}</span>
                    </div>
                  )}

                  {/* توضیحات */}
                  {log.notes && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">توضیحات:</p>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {log.notes}
                      </p>
                    </div>
                  )}
                </article>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
