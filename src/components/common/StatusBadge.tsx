import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'پیش‌نویس', variant: 'outline' },
  pending: { label: 'در انتظار تایید', variant: 'outline' },
  approved: { label: 'تایید شده', variant: 'default' },
  in_progress: { label: 'در حال اجرا', variant: 'default' },
  completed: { label: 'اجرا شده', variant: 'secondary' },
  paid: { label: 'پرداخت شده', variant: 'secondary' },
  closed: { label: 'به اتمام رسیده', variant: 'secondary' },
  rejected: { label: 'رد شده', variant: 'destructive' },
  cancelled: { label: 'لغو شده', variant: 'destructive' },
  active: { label: 'فعال', variant: 'default' },
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'outline' };
  
  return (
    <Badge 
      variant={variant || config.variant}
      className={cn('whitespace-nowrap', className)}
    >
      {config.label}
    </Badge>
  );
}
