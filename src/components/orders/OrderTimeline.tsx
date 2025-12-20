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
  paymentConfirmedAt?: string | null; // تاریخ تایید پرداخت
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
  // scheduled status removed
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
  paymentConfirmedAt,
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
    closed: 9, // closed بعد از collected
  };

  const getCurrentStageNumber = (): number => {
    // Final state - closed = 9 یعنی همه مراحل قبلی کامل شده
    if (orderStatus === 'closed') return 9;

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

  // تعیین وضعیت تایید شده یا نه
  const isApprovedOrBeyond = currentStageNumber >= 1 || !!executionStage || ['approved', 'pending_execution', 'in_progress', 'completed', 'closed'].includes(orderStatus);

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
      completed: isApprovedOrBeyond,
      active: orderStatus === 'pending' && !executionStage,
      rejected: isRejected,
      details: isRejected 
        ? `رد شده: ${rejectionReason || 'دلیل مشخص نشده'}`
        : isApprovedOrBeyond
          ? 'سفارش توسط مدیران تایید شد ✓'
          : approvals.length > 0 
            ? `در انتظار تایید: ${approvals.filter(a => a.approved_at).length} از ${approvals.length} مدیر تایید کرده‌اند`
            : 'سفارش در انتظار بررسی و تایید مدیران است',
    },
    {
      status: 'pending_execution',
      label: 'در انتظار اجرا',
      icon: Clock,
      date: finalApprovalDate,
      completed: isStageCompletedByNumber(1),
      active: isCurrentStageByNumber(1) || orderStatus === 'pending_execution',
      details: isStageCompletedByNumber(1)
        ? 'سفارش وارد مرحله اجرا شد ✓'
        : executionStartDate 
          ? `زمان شروع اجرا: ${formatDate(executionStartDate)?.date} - ${formatDate(executionStartDate)?.time}`
          : (isCurrentStageByNumber(1) || orderStatus === 'pending_execution')
            ? 'سفارش تایید شد و منتظر شروع اجراست'
            : undefined,
    },
    {
      status: 'in_progress',
      label: 'در حال اجرا',
      icon: PlayCircle,
      date: executionStartDate,
      completed: isStageCompletedByNumber(2),
      active: isCurrentStageByNumber(2),
      details: isStageCompletedByNumber(2)
        ? 'اجرا با موفقیت انجام شد ✓'
        : executionEndDate 
          ? `مدت زمان اجرا: تا ${formatDate(executionEndDate)?.date} - ${formatDate(executionEndDate)?.time}`
          : isCurrentStageByNumber(2)
            ? 'تیم اجرایی در حال انجام کار هستند'
            : undefined,
    },
    {
      status: 'order_executed',
      label: 'اجرا شده',
      icon: CheckCircle2,
      date: executionStage === 'order_executed' ? executionStageUpdatedAt : undefined,
      completed: isStageCompletedByNumber(3),
      active: isCurrentStageByNumber(3),
      details: isStageCompletedByNumber(3) || isCurrentStageByNumber(3)
        ? 'نصب داربست با موفقیت انجام شد ✓'
        : undefined,
    },
    {
      status: 'awaiting_payment',
      label: 'در انتظار پرداخت',
      icon: Clock,
      date: paymentConfirmedAt || (executionStage === 'awaiting_payment' ? executionStageUpdatedAt : undefined),
      completed: !!paymentConfirmedAt, // فقط وقتی پرداخت تایید شده باشد
      // آیکن سبز بماند تا پرداخت انجام شود - از مرحله اجرا شده تا پرداخت
      active: (currentStageNumber >= 3) && !paymentConfirmedAt,
      details: paymentConfirmedAt
        ? 'پرداخت با موفقیت انجام شد ✓'
        : (currentStageNumber >= 3)
          ? 'لطفاً مبلغ سفارش را پرداخت کنید'
          : undefined,
    },
    {
      status: 'awaiting_collection',
      label: 'در انتظار جمع‌آوری',
      icon: PackageX,
      date: executionStage === 'awaiting_collection' ? executionStageUpdatedAt : undefined,
      // تکمیل شده وقتی به مرحله in_collection یا بالاتر رسیدیم
      completed: isStageCompletedByNumber(5) || executionStage === 'in_collection' || executionStage === 'collected',
      // فعال فقط وقتی دقیقا در این مرحله هستیم و هنوز تکمیل نشده
      active: (isCurrentStageByNumber(3) || isCurrentStageByNumber(5)) && executionStage !== 'in_collection' && executionStage !== 'collected',
      details: (isStageCompletedByNumber(5) || executionStage === 'in_collection' || executionStage === 'collected')
        ? 'تاریخ جمع‌آوری تعیین شد ✓'
        : (isCurrentStageByNumber(3) || isCurrentStageByNumber(5))
          ? 'لطفاً تاریخ فک داربست را تعیین کنید'
          : undefined,
    },
    {
      status: 'in_collection',
      label: 'در حال جمع‌آوری',
      icon: PackageCheck,
      date: executionStage === 'in_collection' ? executionStageUpdatedAt : undefined,
      // تکمیل شده وقتی به مرحله collected یا بالاتر رسیدیم (شماره 7 یا بیشتر)
      completed: isStageCompletedByNumber(6) || executionStage === 'collected' || orderStatus === 'closed',
      // فعال فقط وقتی دقیقا در مرحله in_collection هستیم
      active: isCurrentStageByNumber(6) && executionStage !== 'collected' && orderStatus !== 'closed',
      details: (isStageCompletedByNumber(6) || executionStage === 'collected' || orderStatus === 'closed')
        ? 'داربست در حال جمع‌آوری است ✓'
        : isCurrentStageByNumber(6) 
          ? 'داربست در حال جمع‌آوری است'
          : undefined,
    },
    {
      status: 'collected',
      label: 'جمع‌آوری شد',
      icon: PackageCheck,
      date: executionStage === 'collected' ? executionStageUpdatedAt : (orderStatus === 'closed' ? customerCompletionDate : undefined),
      // تکمیل شده وقتی به مرحله collected رسیدیم یا سفارش بسته شده
      completed: executionStage === 'collected' || isStageCompletedByNumber(7) || orderStatus === 'closed',
      // فعال نباشد چون وقتی collected است یعنی تکمیل شده
      active: false,
      details: (executionStage === 'collected' || isStageCompletedByNumber(7) || orderStatus === 'closed')
        ? 'داربست با موفقیت جمع‌آوری شد ✓'
        : undefined,
    },
    {
      status: 'closed',
      label: 'اتمام سفارش',
      icon: CheckCircle2,
      date: customerCompletionDate,
      // اتمام سفارش فقط وقتی که واقعاً سفارش بسته شده باشد (closed)
      completed: orderStatus === 'closed',
      // فعال وقتی همه مراحل قبلی انجام شده ولی هنوز closed نشده
      active: (executionStage === 'collected' || isStageCompletedByNumber(7)) && orderStatus !== 'closed',
      details: orderStatus === 'closed'
        ? 'سفارش با موفقیت به اتمام رسید ✓' 
        : (executionStage === 'collected' || isStageCompletedByNumber(7))
          ? 'منتظر تایید نهایی مدیر برای اتمام سفارش'
          : undefined,
    },
  ];

  // Find current active step
  const currentStep = steps.find(s => s.active) || steps.find(s => !s.completed) || steps[steps.length - 1];
  const currentStepLabel = isRejected ? 'رد شده' : currentStep?.label || statusMap[orderStatus] || orderStatus;

  // تعیین برچسب بج وضعیت بر اساس مرحله فعلی (نه فقط orderStatus)
  const getBadgeLabel = (): string => {
    if (isRejected) return 'رد شده';
    if (orderStatus === 'closed') return 'اتمام سفارش';
    
    // اگر execution_stage موجود باشد، از آن استفاده کنیم
    if (executionStage) {
      const executionStageLabels: Record<string, string> = {
        'approved': 'در انتظار اجرا',
        'pending_execution': 'در انتظار اجرا',
        'ready': 'آماده اجرا',
        'in_progress': 'در حال اجرا',
        'order_executed': 'اجرا شده',
        'awaiting_payment': 'در انتظار پرداخت',
        'awaiting_collection': 'در انتظار جمع‌آوری',
        'in_collection': 'در حال جمع‌آوری',
        'collected': 'جمع‌آوری شد',
        'completed': 'اتمام سفارش',
      };
      return executionStageLabels[executionStage] || statusMap[orderStatus] || orderStatus;
    }
    
    return statusMap[orderStatus] || orderStatus;
  };

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">مراحل پیشرفت سفارش</CardTitle>
            <Badge variant={isRejected ? 'destructive' : 'default'}>
              {getBadgeLabel()}
            </Badge>
          </div>
        </CardHeader>

        {/* Collapsed View - Current Stage Only */}
        {!isExpanded && (
          <CardContent className="pt-0">
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-all",
              isRejected
                ? "bg-destructive/10 border border-destructive/30"
                : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
            )}>
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all shadow-sm',
                isRejected
                  ? 'border-destructive bg-destructive text-destructive-foreground'
                  : currentStep?.completed
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-200 dark:shadow-emerald-900/50'
                  : 'border-emerald-500 bg-emerald-500 text-white animate-pulse shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50'
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
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                          step.completed && !step.rejected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : step.rejected
                            ? 'border-destructive bg-destructive text-destructive-foreground'
                            : step.active
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50 animate-pulse'
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
                              'font-semibold transition-colors',
                              step.completed && !step.rejected
                                ? 'text-foreground'
                                : step.rejected
                                ? 'text-destructive'
                                : step.active
                                ? 'text-emerald-600 dark:text-emerald-400'
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
