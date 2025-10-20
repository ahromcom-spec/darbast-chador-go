import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { OrderStats } from '@/hooks/useOrderStats';

interface OrdersStatusChartProps {
  stats: OrderStats;
}

const COLORS = {
  pending: 'hsl(var(--chart-1))',
  approved: 'hsl(var(--chart-2))',
  in_progress: 'hsl(var(--chart-3))',
  completed: 'hsl(var(--chart-4))',
  paid: 'hsl(var(--chart-5))',
  closed: 'hsl(240, 60%, 50%)',
  rejected: 'hsl(var(--destructive))',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار',
  approved: 'تایید شده',
  in_progress: 'در حال اجرا',
  completed: 'اجرا شده',
  paid: 'پرداخت شده',
  closed: 'بسته شده',
  rejected: 'رد شده',
};

export const OrdersStatusChart = ({ stats }: OrdersStatusChartProps) => {
  const data = [
    { name: STATUS_LABELS.pending, value: stats.pending, color: COLORS.pending },
    { name: STATUS_LABELS.approved, value: stats.approved, color: COLORS.approved },
    { name: STATUS_LABELS.in_progress, value: stats.in_progress, color: COLORS.in_progress },
    { name: STATUS_LABELS.completed, value: stats.completed, color: COLORS.completed },
    { name: STATUS_LABELS.paid, value: stats.paid, color: COLORS.paid },
    { name: STATUS_LABELS.closed, value: stats.closed, color: COLORS.closed },
    { name: STATUS_LABELS.rejected, value: stats.rejected, color: COLORS.rejected },
  ].filter(item => item.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>توزیع وضعیت سفارشات</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
