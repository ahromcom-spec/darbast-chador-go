import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, FileText, Users, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { formatPersianDate } from '@/lib/dateUtils';

interface DailyLog {
  id: string;
  order_id: string;
  report_date: string;
  activity_description: string | null;
  team_name: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
}

interface OrderDailyLogsProps {
  orderId: string;
}

export function OrderDailyLogs({ orderId }: OrderDailyLogsProps) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [orderId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_daily_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('report_date', { ascending: false });

      if (error) {
        console.error('Error fetching daily logs:', error);
        return;
      }

      setLogs(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return null; // اگر گزارشی نیست نمایش نده
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-amber-100/50 transition-colors">
            <CardTitle className="flex items-center justify-between text-amber-800">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span>گزارش‌های روزانه ({logs.length})</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {logs.map((log, index) => (
              <div key={log.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="space-y-3 p-3 bg-white/60 rounded-lg border border-amber-100">
                  {/* تاریخ */}
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatPersianDate(log.report_date)}
                    </Badge>
                  </div>

                  {/* شرح فعالیت */}
                  {log.activity_description && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">شرح فعالیت و ابعاد:</p>
                      <p className="text-sm bg-amber-50 p-2 rounded border border-amber-100">
                        {log.activity_description}
                      </p>
                    </div>
                  )}

                  {/* اکیپ */}
                  {log.team_name && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-600" />
                      <span className="text-xs text-muted-foreground">اکیپ:</span>
                      <span className="text-sm font-medium">{log.team_name}</span>
                    </div>
                  )}

                  {/* توضیحات */}
                  {log.notes && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">توضیحات:</p>
                      <p className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                        {log.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
