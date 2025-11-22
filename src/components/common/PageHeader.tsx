import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  description?: string;
  showBackButton?: boolean;
  backTo?: string;
  action?: ReactNode;
}

export function PageHeader({ 
  title, 
  description, 
  showBackButton = false, 
  backTo = '/',
  action 
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          {description && (
            <p className="text-foreground mt-2 bg-background/95 backdrop-blur-md px-4 py-3 rounded-lg border border-border shadow-sm">{description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {action}
          {showBackButton && (
            <Button onClick={() => navigate(backTo)} variant="outline">
              <ArrowRight className="h-4 w-4 ml-2" />
              بازگشت
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
