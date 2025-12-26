import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModuleHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  backTo?: string;
  action?: ReactNode;
}

export function ModuleHeader({ 
  title, 
  description, 
  icon,
  backTo = '/profile',
  action 
}: ModuleHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border-b border-border mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div className="bg-primary/10 p-2 rounded-lg shrink-0">
              <span className="text-primary">{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground whitespace-nowrap">{title}</h1>
            {description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 whitespace-nowrap">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          <Button 
            onClick={() => navigate(backTo)} 
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">بازگشت</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
