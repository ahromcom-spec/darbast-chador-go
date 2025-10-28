import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Package, Truck, CreditCard } from 'lucide-react';

interface OrderWorkflowStatusProps {
  status: string;
}

export const OrderWorkflowStatus = ({ status }: OrderWorkflowStatusProps) => {
  const statusConfig: Record<string, { 
    label: string; 
    icon: React.ReactNode; 
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
  }> = {
    draft: {
      label: 'پیش‌نویس',
      icon: <Clock className="h-3 w-3" />,
      variant: 'outline',
      className: 'border-gray-400 text-gray-700'
    },
    pending: {
      label: 'در انتظار تایید',
      icon: <Clock className="h-3 w-3" />,
      variant: 'secondary',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    },
    approved: {
      label: 'تایید شده',
      icon: <CheckCircle className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-green-100 text-green-800 border-green-300'
    },
    in_progress: {
      label: 'در حال اجرا',
      icon: <Truck className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-blue-100 text-blue-800 border-blue-300'
    },
    completed: {
      label: 'تکمیل شده',
      icon: <Package className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-purple-100 text-purple-800 border-purple-300'
    },
    paid: {
      label: 'پرداخت شده',
      icon: <CreditCard className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-teal-100 text-teal-800 border-teal-300'
    },
    closed: {
      label: 'بسته شده',
      icon: <CheckCircle className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-gray-100 text-gray-800 border-gray-300'
    },
    rejected: {
      label: 'رد شده',
      icon: <XCircle className="h-3 w-3" />,
      variant: 'destructive',
      className: 'bg-red-100 text-red-800 border-red-300'
    }
  };

  const config = statusConfig[status] || {
    label: status,
    icon: <Clock className="h-3 w-3" />,
    variant: 'outline' as const,
    className: ''
  };

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};
