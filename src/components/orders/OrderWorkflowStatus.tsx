import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Package, Truck, Calendar, PackageOpen, PackageCheck } from 'lucide-react';

interface OrderWorkflowStatusProps {
  status: string;
  executionStage?: string | null;
}

export const OrderWorkflowStatus = ({ status, executionStage }: OrderWorkflowStatusProps) => {
  const effectiveStatus = (() => {
    // When managers change "stage" we store detail in execution_stage,
    // but customers often only see `status` in UI. Merge them for correct display.
    if ((status === 'completed' || status === 'in_progress') && executionStage) {
      if (
        executionStage === 'awaiting_payment' ||
        executionStage === 'awaiting_collection' ||
        executionStage === 'in_collection' ||
        executionStage === 'collected' ||
        executionStage === 'order_executed'
      ) {
        return executionStage;
      }
    }
    return status;
  })();

  const statusConfig: Record<
    string,
    {
      label: string;
      icon: React.ReactNode;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      className: string;
    }
  > = {
    draft: {
      label: 'پیش‌نویس',
      icon: <Clock className="h-3 w-3" />,
      variant: 'outline',
      className: 'border-gray-400 text-gray-700',
    },
    pending: {
      label: 'در انتظار تایید',
      icon: <Clock className="h-3 w-3" />,
      variant: 'secondary',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
    pending_execution: {
      label: 'در انتظار اجرا',
      icon: <Clock className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-sky-100 text-sky-800 border-sky-300',
    },
    approved: {
      label: 'تایید شده',
      icon: <CheckCircle className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    // scheduled status removed - orders now go directly to pending_execution
    in_progress: {
      label: 'در حال اجرا',
      icon: <Truck className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    order_executed: {
      label: 'اجرا شد',
      icon: <CheckCircle className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    awaiting_payment: {
      label: 'در انتظار پرداخت',
      icon: <Clock className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-orange-100 text-orange-800 border-orange-300',
    },
    awaiting_collection: {
      label: 'در انتظار جمع‌آوری',
      icon: <PackageOpen className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-orange-100 text-orange-800 border-orange-300',
    },
    in_collection: {
      label: 'در حال جمع‌آوری',
      icon: <PackageCheck className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    collected: {
      label: 'جمع‌آوری شد',
      icon: <Package className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-teal-100 text-teal-800 border-teal-300',
    },
    completed: {
      label: 'اتمام سفارش',
      icon: <Package className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-teal-100 text-teal-800 border-teal-300',
    },
    closed: {
      label: 'بسته شده',
      icon: <CheckCircle className="h-3 w-3" />,
      variant: 'default',
      className: 'bg-gray-100 text-gray-800 border-gray-300',
    },
    rejected: {
      label: 'رد شده',
      icon: <XCircle className="h-3 w-3" />,
      variant: 'destructive',
      className: 'bg-red-100 text-red-800 border-red-300',
    },
  };

  const config = statusConfig[effectiveStatus] || {
    label: effectiveStatus,
    icon: <Clock className="h-3 w-3" />,
    variant: 'outline' as const,
    className: '',
  };

  return (
    <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};

