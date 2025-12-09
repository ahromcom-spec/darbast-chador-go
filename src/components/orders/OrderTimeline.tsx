import { Check, Clock, Package, PlayCircle, CheckCircle2, XCircle, DollarSign, PackageX, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimelineStep {
  status: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  date?: string;
  completed: boolean;
  active: boolean;
  rejected?: boolean;
  details?: string;
}

interface OrderTimelineProps {
  orderStatus: string;
  createdAt: string;
  approvedAt?: string;
  executionStartDate?: string;
  executionEndDate?: string;
  customerCompletionDate?: string;
  rejectionReason?: string;
  executionStage?: string | null; // مرحله اجرایی فعلی
  executionStageUpdatedAt?: string | null;
  approvals?: Array<{
    approver_role: string;
    approved_at: string | null;
    approver_user_id: string | null;
  }>;
}

const statusMap: Record<string, string> = {
  'draft': 'پیش‌نویس',
  'pending': 'در انتظار تایید',
  'pending_execution': 'در انتظار اجرا',
  'approved': 'تایید شده',
  'in_progress': 'در حال اجرا',
  'awaiting_payment': 'در انتظار پرداخت',
  'awaiting_collection': 'سفارش در انتظار جمع‌آوری',
  'collecting': 'سفارش در حال جمع‌آوری',
  'completed': 'اتمام سفارش',
  'paid': 'پرداخت شده',
  'closed': 'بسته شده',
  'rejected': 'رد شده',
};

const roleNameMap: Record<string, string> = {
  'ceo': 'مدیرعامل',
  'sales_manager': 'مدیر فروش',
  'scaffold_executive_manager': 'مدیر اجرایی',
  'general_manager': 'مدیر کل',
};

export const OrderTimeline = ({
  orderStatus,
  createdAt,
  approvedAt,
  executionStartDate,
  executionEndDate,
  customerCompletionDate,
  rejectionReason,
  executionStage,
  executionStageUpdatedAt,
  approvals = [],
}: OrderTimelineProps) => {
  const isRejected = orderStatus === 'rejected';

  // محاسبه تاریخ تایید کامل (زمانی که همه مدیران تایید کردند)
  const allApprovalsCompleted = approvals.length > 0 && approvals.every(a => a.approved_at);
  const finalApprovalDate = allApprovalsCompleted 
    ? approvals.reduce((latest, a) => {
        if (!a.approved_at) return latest;
        return !latest || new Date(a.approved_at) > new Date(latest) ? a.approved_at : latest;
      }, '')
    : approvedAt;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fa-IR'),
      time: date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  // تعیین وضعیت هر مرحله بر اساس execution_stage - یکسان با سربرگ‌های مدیر اجرایی
  const stageOrder: Record<string, number> = {
    approved: 1,        // آماده اجرا
    in_progress: 2,     // در حال اجرا
    awaiting_payment: 3, // در انتظار پرداخت
    order_executed: 4,   // سفارش اجرا شده
    awaiting_collection: 5, // سفارش در انتظار جمع‌آوری
    in_collection: 6,    // سفارش در حال جمع‌آوری
    closed: 7,           // تکمیل شده
  };

  const isStageCompleted = (stageKey: string): boolean => {
    if (!executionStage && !orderStatus) return false;
    
    // اگر execution_stage وجود دارد، از آن استفاده کن
    if (executionStage) {
      const currentOrder = stageOrder[executionStage] || 0;
      const checkOrder = stageOrder[stageKey] || 0;
      return checkOrder < currentOrder;
    }
    
    // اگر execution_stage نیست، از status استفاده کن
    const currentOrder = stageOrder[orderStatus] || 0;
    const checkOrder = stageOrder[stageKey] || 0;
    return checkOrder < currentOrder;
  };

  const isCurrentStage = (stageKey: string): boolean => {
    if (executionStage) return executionStage === stageKey;
    return orderStatus === stageKey;
  };

  const steps: TimelineStep[] = [
    {
      status: 'created',
      label: 'ثبت سفارش',
      icon: Package,
      date: createdAt,
      completed: true,
      active: orderStatus === 'draft',
      details: 'سفارش شما با موفقیت ثبت شد',
    },
    {
      status: 'pending',
      label: 'در انتظار تایید مدیران',
      icon: Clock,
      date: createdAt,
      completed: ['pending_execution', 'approved', 'in_progress', 'awaiting_payment', 'awaiting_collection', 'collecting', 'completed', 'paid', 'closed'].includes(orderStatus) || !!executionStage,
      active: orderStatus === 'pending',
      rejected: isRejected,
      details: isRejected 
        ? `رد شده: ${rejectionReason || 'دلیل مشخص نشده'}`
        : approvals.length > 0 
          ? `تایید ${approvals.filter(a => a.approved_at).length} از ${approvals.length} مدیر`
          : undefined,
    },
    {
      status: 'approved',
      label: 'آماده اجرا',
      icon: Clock,
      date: finalApprovalDate,
      completed: isStageCompleted('approved') || ['in_progress', 'awaiting_payment', 'awaiting_collection', 'collecting', 'completed', 'paid', 'closed'].includes(orderStatus) || (!!executionStage && stageOrder[executionStage] > 1),
      active: isCurrentStage('approved') || orderStatus === 'approved',
      details: executionStartDate 
        ? `زمان شروع اجرا: ${formatDate(executionStartDate)?.date} - ${formatDate(executionStartDate)?.time}`
        : 'سفارش تایید شد و منتظر شروع اجراست',
    },
    {
      status: 'in_progress',
      label: 'در حال اجرا',
      icon: PlayCircle,
      date: executionStartDate,
      completed: isStageCompleted('in_progress') || (!!executionStage && stageOrder[executionStage] > 2),
      active: isCurrentStage('in_progress') || orderStatus === 'in_progress',
      details: executionEndDate 
        ? `مدت زمان اجرا: تا ${formatDate(executionEndDate)?.date} - ${formatDate(executionEndDate)?.time}`
        : undefined,
    },
    {
      status: 'awaiting_payment',
      label: 'در انتظار پرداخت',
      icon: DollarSign,
      date: isCurrentStage('awaiting_payment') ? executionStageUpdatedAt : undefined,
      completed: isStageCompleted('awaiting_payment'),
      active: isCurrentStage('awaiting_payment'),
      details: isCurrentStage('awaiting_payment') ? 'سفارش اجرا شده و منتظر پرداخت است' : undefined,
    },
    {
      status: 'order_executed',
      label: 'سفارش اجرا شده',
      icon: CheckCircle2,
      date: isCurrentStage('order_executed') ? executionStageUpdatedAt : undefined,
      completed: isStageCompleted('order_executed'),
      active: isCurrentStage('order_executed'),
      details: undefined,
    },
    {
      status: 'awaiting_collection',
      label: 'سفارش در انتظار جمع‌آوری',
      icon: PackageX,
      date: isCurrentStage('awaiting_collection') ? executionStageUpdatedAt : undefined,
      completed: isStageCompleted('awaiting_collection'),
      active: isCurrentStage('awaiting_collection'),
      details: undefined,
    },
    {
      status: 'in_collection',
      label: 'سفارش در حال جمع‌آوری',
      icon: PackageCheck,
      date: isCurrentStage('in_collection') ? executionStageUpdatedAt : undefined,
      completed: isStageCompleted('in_collection'),
      active: isCurrentStage('in_collection'),
      details: undefined,
    },
    {
      status: 'closed',
      label: 'اتمام سفارش',
      icon: CheckCircle2,
      date: customerCompletionDate,
      completed: orderStatus === 'closed',
      active: isCurrentStage('closed'),
      details: undefined,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">مراحل پیشرفت سفارش</CardTitle>
          <Badge variant={isRejected ? 'destructive' : 'default'}>
            {statusMap[orderStatus] || orderStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const dateInfo = formatDate(step.date);
            const isLast = index === steps.length - 1;

            return (
              <div key={step.status} className="relative">
                {/* خط اتصال */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute right-4 top-10 h-full w-0.5',
                      step.completed && !step.rejected
                        ? 'bg-primary'
                        : step.rejected
                        ? 'bg-destructive'
                        : 'bg-border'
                    )}
                  />
                )}

                <div className="flex items-start gap-4">
                  {/* آیکون */}
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      step.completed && !step.rejected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : step.rejected
                        ? 'border-destructive bg-destructive text-destructive-foreground'
                        : step.active
                        ? 'border-primary bg-background text-primary'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    {step.rejected ? (
                      <XCircle className="h-4 w-4" />
                    ) : step.completed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  {/* محتوا */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center justify-between gap-4">
                      <h4
                        className={cn(
                          'font-semibold',
                          step.completed && !step.rejected
                            ? 'text-foreground'
                            : step.rejected
                            ? 'text-destructive'
                            : step.active
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                      >
                        {step.label}
                      </h4>
                      {dateInfo && (
                        <div className="text-left text-sm text-muted-foreground">
                          <div>{dateInfo.date}</div>
                          <div className="text-xs">{dateInfo.time}</div>
                        </div>
                      )}
                    </div>

                    {/* جزئیات */}
                    {step.details && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {step.details}
                      </p>
                    )}

                    {/* نمایش جزئیات تاییدات */}
                    {step.status === 'pending' && approvals.length > 0 && !isRejected && (
                      <div className="mt-3 space-y-2">
                        {approvals.map((approval) => {
                          const approvalDate = formatDate(approval.approved_at || undefined);
                          return (
                            <div
                              key={approval.approver_role}
                              className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                {approval.approved_at ? (
                                  <Check className="h-4 w-4 text-primary" />
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span>
                                  {roleNameMap[approval.approver_role] || approval.approver_role}
                                </span>
                              </div>
                              {approvalDate && (
                                <div className="text-left text-xs text-muted-foreground">
                                  <div>{approvalDate.date}</div>
                                  <div>{approvalDate.time}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
