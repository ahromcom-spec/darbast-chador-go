import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  DollarSign,
  AlertCircle,
  PlayCircle,
  XCircle
} from 'lucide-react';
import { OrderStats } from '@/hooks/useOrderStats';

interface QuickStatsGridProps {
  stats: OrderStats;
  loading?: boolean;
}

export const QuickStatsGrid = ({ stats, loading }: QuickStatsGridProps) => {
  const statCards = [
    {
      title: 'کل سفارشات',
      value: stats.total,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'در انتظار تایید',
      value: stats.pending,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
    },
    {
      title: 'در حال اجرا',
      value: stats.in_progress,
      icon: PlayCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      title: 'تکمیل شده',
      value: stats.completed,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'پرداخت شده',
      value: stats.paid,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      title: 'بسته شده',
      value: stats.closed,
      icon: CheckCircle2,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-950',
    },
    {
      title: 'رد شده',
      value: stats.rejected,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
    {
      title: 'میانگین ارزش سفارش',
      value: `${Math.round(stats.averageOrderValue).toLocaleString('fa-IR')} تومان`,
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950',
      isNumeric: false,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stat.isNumeric === false ? stat.value : stat.value.toLocaleString('fa-IR')}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
