import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stage {
  id: string;
  stage_key: string;
  stage_title: string;
  order_index: number;
  is_completed: boolean;
  completed_at?: string;
}

interface ProjectProgressBarProps {
  stages: Stage[];
  onStageClick?: (stage: Stage) => void;
  canEdit?: boolean;
}

export const ProjectProgressBar = ({ stages, onStageClick, canEdit = false }: ProjectProgressBarProps) => {
  const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index);
  const completedCount = sortedStages.filter(s => s.is_completed).length;
  const progressPercentage = (completedCount / sortedStages.length) * 100;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">پیشرفت کلی پروژه</span>
          <span className="text-muted-foreground">
            {completedCount} از {sortedStages.length} مرحله
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        <p className="text-xs text-muted-foreground text-left">
          {Math.round(progressPercentage)}%
        </p>
      </div>

      {/* Stages Timeline */}
      <div className="space-y-2">
        {sortedStages.map((stage, index) => (
          <div
            key={stage.id}
            onClick={() => canEdit && onStageClick?.(stage)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              stage.is_completed && 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900',
              !stage.is_completed && 'bg-muted/30',
              canEdit && 'cursor-pointer hover:bg-accent'
            )}
          >
            <div className="flex-shrink-0">
              {stage.is_completed ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium',
                  stage.is_completed && 'text-green-700 dark:text-green-400'
                )}>
                  {stage.stage_title}
                </span>
                {stage.is_completed && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    تکمیل شده
                  </Badge>
                )}
              </div>
              {stage.completed_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  تکمیل: {new Date(stage.completed_at).toLocaleDateString('fa-IR')}
                </p>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              مرحله {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
