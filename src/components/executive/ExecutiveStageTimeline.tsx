import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface ExecutiveStage {
  key: string;
  label: string;
  order: number;
}

const executiveStages: ExecutiveStage[] = [
  { key: 'awaiting_payment', label: 'در انتظار پرداخت', order: 1 },
  { key: 'order_executed', label: 'سفارش اجرا شده', order: 2 },
  { key: 'awaiting_collection', label: 'سفارش در انتظار جمع‌آوری', order: 3 },
  { key: 'in_collection', label: 'سفارش در حال جمع‌آوری', order: 4 },
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
    
    // فقط می‌توان به مرحله بعدی یا همان مرحله فعلی رفت
    if (stage.order > currentStageOrder + 1) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'باید مراحل را به ترتیب تکمیل کنید'
      });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('projects_v3')
        .update({
          execution_stage: stage.key as 'awaiting_payment' | 'order_executed' | 'awaiting_collection' | 'in_collection',
          execution_stage_updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: '✓ مرحله به‌روزرسانی شد',
        description: `سفارش به مرحله "${stage.label}" منتقل شد.`
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
        const isNext = stage.order === currentStageOrder + 1;
        const isClickable = !readOnly && (isCurrent || isNext);

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
                !isClickable && !readOnly && 'opacity-50'
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

              {isNext && !readOnly && (
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
                  تکمیل
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
