import { useState } from 'react';
import { Check, Clock, Package, PlayCircle, CheckCircle2, XCircle, PackageX, PackageCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  'awaiting_collection': 'در انتظار جمع‌آوری',
  'in_collection': 'در حال جمع‌آوری',
  'completed': 'اتمام سفارش',
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
  const [isExpanded, setIsExpanded] = useState(false);
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

  // تعیین وضعیت هر مرحله بر اساس execution_stage
  const stageOrder: Record<string, number> = {
    approved: 1,
    pending_execution: 1,
    ready: 1, // آماده اجرا
    in_progress: 2,
    order_executed: 3,
    awaiting_payment: 4, // در انتظار پرداخت
    awaiting_collection: 5,
    in_collection: 6,
    collected: 7,
    completed: 8,
    closed: 8,
  };

  const getCurrentStageNumber = (): number => {
    // Final state
    if (orderStatus === 'closed') return 6;

    // Prefer execution_stage when present (even if status is 'completed')
    if (executionStage) {
      return stageOrder[executionStage] ?? stageOrder[orderStatus] ?? 0;
    }

    return stageOrder[orderStatus] ?? 0;
  };

  const currentStageNumber = getCurrentStageNumber();

  const isStageCompletedByNumber = (stageNum: number): boolean => {
    return currentStageNumber > stageNum;
  };

  const isCurrentStageByNumber = (stageNum: number): boolean => {
    return currentStageNumber === stageNum;
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
      completed: currentStageNumber >= 1 || !!executionStage,
      active: orderStatus === 'pending' && !executionStage,
      rejected: isRejected,
      details: isRejected 
        ? `رد شده: ${rejectionReason || 'دلیل مشخص نشده'}`
        : approvals.length > 0 
          ? `تایید ${approvals.filter(a => a.approved_at).length} از ${approvals.length} مدیر`
          : undefined,
    },
    {
      status: 'approved',
      label: 'در انتظار اجرا',
      icon: Clock,
      date: finalApprovalDate,
      completed: isStageCompletedByNumber(1),
      active: isCurrentStageByNumber(1),
      details: executionStartDate 
        ? `زمان شروع اجرا: ${formatDate(executionStartDate)?.date} - ${formatDate(executionStartDate)?.time}`
        : 'سفارش تایید شد و منتظر شروع اجراست',
    },
    {
      status: 'in_progress',
      label: 'در حال اجرا',
      icon: PlayCircle,
      date: executionStartDate,
      completed: isStageCompletedByNumber(2),
      active: isCurrentStageByNumber(2),
      details: executionEndDate 
        ? `مدت زمان اجرا: تا ${formatDate(executionEndDate)?.date} - ${formatDate(executionEndDate)?.time}`
        : undefined,
    },
    {
      status: 'order_executed',
      label: 'اجرا شده',
      icon: CheckCircle2,
      date: executionStage === 'order_executed' ? executionStageUpdatedAt : undefined,
      completed: isStageCompletedByNumber(3),
      active: isCurrentStageByNumber(3),
      details: isCurrentStageByNumber(3) ? 'اجرا تکمیل شد' : undefined,
    },
    {
      status: 'awaiting_payment',
      label: 'در انتظار پرداخت',
      icon: Clock,
      date: executionStage === 'awaiting_payment' ? executionStageUpdatedAt : undefined,
      completed: isStageCompletedByNumber(4),
      active: isCurrentStageByNumber(4),
      details: isCurrentStageByNumber(4) ? 'لطفاً مبلغ سفارش را پرداخت کنید' : undefined,
    },
    {
      status: 'awaiting_collection',
      label: 'در انتظار جمع‌آوری',
      icon: PackageX,
      date: executionStage === 'awaiting_collection' ? executionStageUpdatedAt : undefined,
      completed: isStageCompletedByNumber(5),
      active: isCurrentStageByNumber(5),
      details: isCurrentStageByNumber(5) ? 'لطفاً تاریخ فک داربست را تعیین کنید' : undefined,
    },
    {
      status: 'in_collection',
      label: 'در حال جمع‌آوری',
      icon: PackageCheck,
      date: executionStage === 'in_collection' ? executionStageUpdatedAt : undefined,
      completed: isStageCompletedByNumber(6),
      active: isCurrentStageByNumber(6),
      details: isCurrentStageByNumber(6) ? 'داربست در حال جمع‌آوری است' : undefined,
    },
    {
      status: 'collected',
      label: 'جمع‌آوری شد',
      icon: PackageCheck,
      date: executionStage === 'collected' ? executionStageUpdatedAt : undefined,
      completed: isStageCompletedByNumber(7),
      active: isCurrentStageByNumber(7),
      details: isCurrentStageByNumber(7) ? 'داربست با موفقیت جمع‌آوری شد' : undefined,
    },
    {
      status: 'closed',
      label: 'اتمام سفارش',
      icon: CheckCircle2,
      date: customerCompletionDate,
      completed: isCurrentStageByNumber(8) || orderStatus === 'completed' || orderStatus === 'closed',
      active: isCurrentStageByNumber(8),
      details: (orderStatus === 'closed' || orderStatus === 'completed' || isCurrentStageByNumber(8)) ? 'سفارش با موفقیت به اتمام رسید' : undefined,
    },
  ];

  // Find current active step
  const currentStep = steps.find(s => s.active) || steps.find(s => !s.completed) || steps[steps.length - 1];
  const currentStepLabel = isRejected ? 'رد شده' : currentStep?.label || statusMap[orderStatus] || orderStatus;

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">مراحل پیشرفت سفارش</CardTitle>
            <Badge variant={isRejected ? 'destructive' : 'default'}>
              {statusMap[orderStatus] || orderStatus}
            </Badge>
          </div>
        </CardHeader>

        {/* Collapsed View - Current Stage Only */}
        {!isExpanded && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                isRejected
                  ? 'border-destructive bg-destructive text-destructive-foreground'
                  : currentStep?.completed
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-primary bg-background text-primary'
              )}>
                {isRejected ? (
                  <XCircle className="h-5 w-5" />
                ) : currentStep?.completed ? (
                  <Check className="h-5 w-5" />
                ) : currentStep ? (
                  <currentStep.icon className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <p className={cn(
                  'font-semibold',
                  isRejected ? 'text-destructive' : 'text-foreground'
                )}>
                  {currentStepLabel}
                </p>
                {currentStep?.details && (
                  <p className="text-sm text-muted-foreground mt-0.5">{currentStep.details}</p>
                )}
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-3 gap-2">
                <ChevronDown className="h-4 w-4" />
                مشاهده جزئیات مراحل
              </Button>
            </CollapsibleTrigger>
          </CardContent>
        )}

        {/* Expanded View - Full Timeline */}
        <CollapsibleContent>
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
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-3 gap-2">
                <ChevronUp className="h-4 w-4" />
                بستن جزئیات
              </Button>
            </CollapsibleTrigger>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
