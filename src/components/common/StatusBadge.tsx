import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'فعال', variant: 'default' },
  completed: { label: 'تکمیل شده', variant: 'secondary' },
  pending: { label: 'در انتظار', variant: 'outline' },
  cancelled: { label: 'لغو شده', variant: 'destructive' },
  in_progress: { label: 'در حال انجام', variant: 'default' },
  approved: { label: 'تایید شده', variant: 'default' },
  rejected: { label: 'رد شده', variant: 'destructive' },
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
