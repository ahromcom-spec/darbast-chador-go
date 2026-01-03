import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { sendNotificationSchema } from '@/lib/rpcValidation';

interface ExecutiveStage {
  key: string;
  label: string;
  order: number;
  statusMapping: string; // وضعیت متناظر در projects_v3.status
}

// مراحل اجرایی با mapping به status - بدون مرحله پرداخت
export const executiveStages: ExecutiveStage[] = [
  { key: 'approved', label: 'در انتظار اجرا', order: 1, statusMapping: 'approved' },
  { key: 'in_progress', label: 'در حال اجرا', order: 2, statusMapping: 'in_progress' },
  { key: 'awaiting_collection', label: 'در انتظار جمع‌آوری', order: 3, statusMapping: 'completed' },
  { key: 'in_collection', label: 'در حال جمع‌آوری', order: 4, statusMapping: 'completed' },
  { key: 'closed', label: 'اتمام سفارش', order: 5, statusMapping: 'closed' },
];

interface ExecutiveStageTimelineProps {
  projectId: string;
  currentStage: string | null;
  onStageChange?: () => void;
  readOnly?: boolean;
}

export const ExecutiveStageTimeline = ({
  projectId,
  currentStage,
  onStageChange,
  readOnly = false
}: ExecutiveStageTimelineProps) => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const currentStageOrder = executiveStages.find(s => s.key === currentStage)?.order || 0;

  const handleStageClick = async (stage: ExecutiveStage) => {
    if (readOnly) return;
    
    // اگر مرحله فعلی است، نیازی به تغییر نیست
    if (stage.key === currentStage) {
      return;
    }

    setUpdating(true);
    try {
      // دریافت اطلاعات سفارش برای ارسال اعلان
      const { data: orderData } = await supabase
        .from('projects_v3')
        .select('customer_id, code')
        .eq('id', projectId)
        .single();

      // به‌روزرسانی هم execution_stage و هم status بر اساس مرحله
      const updateData: Record<string, any> = {
        execution_stage: stage.key,
        execution_stage_updated_at: new Date().toISOString(),
        status: stage.statusMapping
      };

      const { error } = await supabase
        .from('projects_v3')
        .update(updateData)
        .eq('id', projectId);

      if (error) throw error;

      // ارسال اعلان به مشتری
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', orderData.customer_id)
          .single();

        if (customerData?.user_id) {
          const stageMessages: Record<string, { title: string; body: string }> = {
            approved: {
              title: '✅ سفارش در انتظار اجرا',
              body: `سفارش ${orderData.code} تایید شد و در انتظار اجرا است.`
            },
            in_progress: {
              title: '🚧 سفارش در حال اجرا',
              body: `اجرای سفارش ${orderData.code} آغاز شده است.`
            },
            awaiting_collection: {
              title: '📦 سفارش در انتظار جمع‌آوری',
              body: `اجرای سفارش ${orderData.code} تکمیل شد. لطفاً تاریخ فک داربست را تعیین کنید.`
            },
            in_collection: {
              title: '🔧 داربست در حال جمع‌آوری',
              body: `جمع‌آوری داربست سفارش ${orderData.code} آغاز شده است.`
            },
            closed: {
              title: '🎉 سفارش تکمیل شد',
              body: `سفارش ${orderData.code} با موفقیت به اتمام رسید.`
            }
          };

          const message = stageMessages[stage.key];
          if (message) {
            try {
              // ارسال نوتیفیکیشن درون‌سایتی
              const validated = sendNotificationSchema.parse({
                _user_id: customerData.user_id,
                _title: message.title,
                _body: message.body,
                _link: `/user/orders/${projectId}`,
                _type: 'info'
              });
              await supabase.rpc('send_notification', validated as { _user_id: string; _title: string; _body: string; _link?: string; _type?: string });
              
              // ارسال Push Notification به گوشی کاربر
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  user_id: customerData.user_id,
                  title: message.title,
                  body: message.body,
                  link: `/user/orders/${projectId}`,
                  type: 'order-stage'
                }
              });
            } catch (notifError) {
              console.error('Error sending notification:', notifError);
            }
          }
        }
      }

      toast({
        title: '✓ مرحله به‌روزرسانی شد',
        description: `سفارش به مرحله "${stage.label}" منتقل شد و به مشتری اطلاع داده شد.`
      });

      onStageChange?.();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در به‌روزرسانی مرحله'
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-2">
      {executiveStages.map((stage, index) => {
        const isCompleted = stage.order < currentStageOrder;
        const isCurrent = stage.key === currentStage;
        const isClickable = !readOnly && !isCurrent;

        return (
          <div key={stage.key} className="relative">
            {/* خط اتصال */}
            {index < executiveStages.length - 1 && (
              <div
                className={cn(
                  'absolute right-[15px] top-8 w-[2px] h-6',
                  isCompleted || isCurrent ? 'bg-primary' : 'bg-border'
                )}
              />
            )}

            {/* مرحله */}
            <div
              onClick={() => isClickable && handleStageClick(stage)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-all',
                isCompleted && 'bg-primary/10 border-primary/30',
                isCurrent && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
                !isCompleted && !isCurrent && 'bg-muted/30 border-border',
                isClickable && 'cursor-pointer hover:bg-accent hover:shadow-md',
                isCurrent && 'ring-2 ring-blue-500'
              )}
            >
              <div className="flex-shrink-0">
                {updating && isCurrent ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle className="h-6 w-6 text-primary" />
                ) : isCurrent ? (
                  <div className="h-6 w-6 rounded-full border-2 border-blue-600 bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
                  </div>
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1">
                <p
                  className={cn(
                    'font-medium text-sm',
                    isCompleted && 'text-primary',
                    isCurrent && 'text-blue-700 dark:text-blue-400',
                    !isCompleted && !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {stage.label}
                </p>
              </div>

              {isClickable && !readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStageClick(stage);
                  }}
                  disabled={updating}
                  className="text-xs"
                >
                  {stage.order < currentStageOrder ? 'برگشت' : 'انتقال'}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
