import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Award, TrendingUp } from 'lucide-react';

interface ManagerActivitySummaryProps {
  userId: string;
}

export function ManagerActivitySummary({ userId }: ManagerActivitySummaryProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['manager-activity-summary', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('action, created_at')
        .eq('actor_user_id', userId)
        .in('action', ['approve_order', 'reject_order', 'approve_staff_request', 'reject_staff_request', 'approve_contractor']);

      if (error) throw error;

      const totalApprovals = data?.filter(d => d.action.includes('approve')).length || 0;
      const totalRejections = data?.filter(d => d.action.includes('reject')).length || 0;
      const totalActions = data?.length || 0;

      // محاسبه فعالیت‌های این ماه
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const thisMonthActions = data?.filter(d => 
        new Date(d.created_at) >= thisMonthStart
      ).length || 0;

      return {
        totalApprovals,
        totalRejections,
        totalActions,
        thisMonthActions,
        approvalRate: totalActions > 0 ? Math.round((totalApprovals / totalActions) * 100) : 0
      };
    }
  });

  if (isLoading || !stats) {
    return null;
  }

  const summaryCards = [
    {
      title: 'کل تاییدیه‌ها',
      value: stats.totalApprovals,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'موارد رد شده',
      value: stats.totalRejections,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'فعالیت این ماه',
      value: stats.thisMonthActions,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'نرخ تایید',
      value: `${stats.approvalRate}%`,
      icon: Award,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {summaryCards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
