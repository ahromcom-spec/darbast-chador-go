import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, Users, ShoppingCart } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface RecentActivityFeedProps {
  userId: string;
  limit?: number;
}

export function RecentActivityFeed({ userId, limit = 10 }: RecentActivityFeedProps) {
  const { data: recentActivity, isLoading } = useQuery({
    queryKey: ['recent-activity', userId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, entity, meta, created_at')
        .eq('actor_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    }
  });

  const getActivityIcon = (action: string) => {
    if (action.includes('order')) return ShoppingCart;
    if (action.includes('staff') || action.includes('role')) return Users;
    return Activity;
  };

  const getActivityText = (activity: any) => {
    const actionMap: Record<string, string> = {
      approve_order: 'سفارش را تایید کرد',
      reject_order: 'سفارش را رد کرد',
      approve_staff_request: 'درخواست پرسنل را تایید کرد',
      reject_staff_request: 'درخواست پرسنل را رد کرد',
      approve_contractor: 'پیمانکار را تایید کرد',
      assign_role: 'نقش اختصاص داد',
      remove_role: 'نقش را حذف کرد',
      create_order: 'سفارش ثبت کرد'
    };

    let text = actionMap[activity.action] || activity.action;
    
    if (activity.meta?.code) {
      text += ` (${activity.meta.code})`;
    } else if (activity.meta?.role) {
      text += ` (${activity.meta.role})`;
    }

    return text;
  };

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);

    if (diffInMinutes < 1) return 'لحظاتی پیش';
    if (diffInMinutes < 60) return `${diffInMinutes} دقیقه پیش`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ساعت پیش`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} روز پیش`;
    
    return new Date(date).toLocaleDateString('fa-IR');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!recentActivity || recentActivity.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>فعالیت‌های اخیر</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentActivity.map((activity) => {
            const IconComponent = getActivityIcon(activity.action);
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <IconComponent className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getActivityText(activity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getRelativeTime(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
